begin;
create table public.teacher_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null, expertise text not null, experience text not null, qualifications text not null default '',
 status text not null default 'submitted' check (status in ('submitted','approved','changes_requested')),
 review_notes text not null default '', age_confirmed_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.community_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 3 and 100), description text not null check(length(description) between 10 and 1000),
 category text not null check(category in ('personal-care','clothing','independent-living','diy','hobbies','preparedness')),
 support_count integer not null default 0 check(support_count>=0), created_at timestamptz not null default now()
);
create table public.community_supports (
 request_id uuid not null references public.community_requests(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key(request_id,user_id)
);
create index community_supports_user on public.community_supports(user_id);
create table public.platform_lessons (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(user_id), teacher_name text not null,
 request_id uuid references public.community_requests(id) on delete set null,
 status text not null default 'draft' check(status in ('draft','submitted','changes_requested','published')),
 document jsonb not null, transcript text not null default '', demo_path text,
 contribution_license boolean not null check(contribution_license), license_version text not null,
 training_opt_in boolean not null default false, rights_recorded_at timestamptz not null default now(),
 version integer not null default 0, submitted_version_id uuid, published_version_id uuid, published_at timestamptz,
 review_notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index platform_lessons_teacher on public.platform_lessons(teacher_id);
create index platform_lessons_request on public.platform_lessons(request_id);
create table public.platform_lesson_versions (
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references public.platform_lessons(id), version integer not null,
 document jsonb not null, transcript text not null, demo_path text not null, teacher_name text not null,
 contribution_license boolean not null check(contribution_license), license_version text not null, training_opt_in boolean not null,
 created_at timestamptz not null default now(), unique(lesson_id,version)
);
alter table public.platform_lessons add constraint submitted_version_fk foreign key(submitted_version_id) references public.platform_lesson_versions(id);
alter table public.platform_lessons add constraint published_version_fk foreign key(published_version_id) references public.platform_lesson_versions(id);
create table public.platform_reviews (
 id uuid primary key default gen_random_uuid(), reviewer_id uuid not null references auth.users(id), target_user_id uuid references auth.users(id),
 lesson_id uuid references public.platform_lessons(id), version_id uuid references public.platform_lesson_versions(id),
 decision text not null check(decision in ('approve','publish','changes_requested','withdraw')), notes text not null,
 created_at timestamptz not null default now()
);
create index platform_reviews_lesson on public.platform_reviews(lesson_id);
create index platform_reviews_reviewer on public.platform_reviews(reviewer_id);
create index platform_reviews_target on public.platform_reviews(target_user_id);
create index platform_reviews_version on public.platform_reviews(version_id);
create table public.platform_uploads (
 path text primary key, teacher_id uuid not null references auth.users(id), lesson_id uuid not null references public.platform_lessons(id),
 size bigint not null check(size>0 and size<=104857600), content_type text not null check(content_type in ('video/mp4','video/webm','video/quicktime')),
 attached_at timestamptz, created_at timestamptz not null default now()
);
create index platform_uploads_teacher on public.platform_uploads(teacher_id);
create index platform_uploads_lesson on public.platform_uploads(lesson_id);
create table public.coaching_reports (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 skill text not null, lesson_id uuid, lesson_version integer, step integer not null check(step>=0), status text not null, confidence text not null,
 observation text not null, guidance text not null, reason text not null check(length(reason) between 1 and 2000),
 created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references auth.users(id), resolution text not null default ''
);
create index coaching_reports_user on public.coaching_reports(user_id);
create index coaching_reports_reviewer on public.coaching_reports(resolved_by);

-- The service API is the only writer. Browser roles cannot bypass validation,
-- impersonate an actor, grant teacher status, publish content or inspect drafts.
alter table public.teacher_profiles enable row level security;
alter table public.community_requests enable row level security;
alter table public.community_supports enable row level security;
alter table public.platform_lessons enable row level security;
alter table public.platform_lesson_versions enable row level security;
alter table public.platform_reviews enable row level security;
alter table public.platform_uploads enable row level security;
alter table public.coaching_reports enable row level security;
revoke all on public.teacher_profiles, public.community_requests, public.community_supports, public.platform_lessons, public.platform_lesson_versions, public.platform_reviews, public.platform_uploads, public.coaching_reports from anon, authenticated;
grant select,insert,update,delete on public.teacher_profiles, public.community_requests, public.community_supports, public.platform_lessons, public.platform_uploads, public.coaching_reports to service_role;
grant select,insert on public.platform_lesson_versions, public.platform_reviews to service_role;

-- Immutable submissions preserve exactly what an independent reviewer approved.
create function public.platform_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'immutable history'; end;
$$;
revoke all on function public.platform_immutable() from public, anon, authenticated;
create trigger immutable_lesson_version before update or delete on public.platform_lesson_versions for each row execute function public.platform_immutable();
create trigger immutable_platform_review before update or delete on public.platform_reviews for each row execute function public.platform_immutable();

create function public.platform_mutate(actor_id uuid, is_reviewer boolean, payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 action text := payload->>'action'; target uuid; lesson public.platform_lessons%rowtype; profile public.teacher_profiles%rowtype;
 new_id uuid; new_version uuid; changed integer; approved text;
begin
 if actor_id is null then raise exception 'forbidden'; end if;
 if action='request' then
  insert into public.community_requests(user_id,title,description,category) values(actor_id,payload->>'title',payload->>'description',payload->>'category') returning id into new_id;
  return jsonb_build_object('ok',true,'requestId',new_id);
 elsif action='support' then
  target:=(payload->>'requestId')::uuid;
  perform 1 from public.community_requests where id=target for update;
  if not found then raise exception 'not_found'; end if;
  if (payload->>'support')::boolean then
   insert into public.community_supports(request_id,user_id) values(target,actor_id) on conflict do nothing;
  else
   delete from public.community_supports where request_id=target and user_id=actor_id;
  end if;
  -- Count under the request row lock; repeated support is idempotent.
  update public.community_requests set support_count=(select count(*) from public.community_supports where request_id=target) where id=target;
  return jsonb_build_object('ok',true);
 elsif action='apply' then
  select * into profile from public.teacher_profiles where user_id=actor_id for update;
  if found and profile.status='approved' then raise exception 'conflict'; end if;
  insert into public.teacher_profiles(user_id,display_name,expertise,experience,qualifications)
  values(actor_id,payload->>'displayName',payload->>'expertise',payload->>'experience',payload->>'qualifications')
  on conflict(user_id) do update set display_name=excluded.display_name,expertise=excluded.expertise,experience=excluded.experience,qualifications=excluded.qualifications,status='submitted',review_notes='',updated_at=now();
  return jsonb_build_object('ok',true);
 elsif action='reviewApplication' then
  target:=(payload->>'userId')::uuid;
  if not is_reviewer or target=actor_id then raise exception 'forbidden'; end if;
  select * into profile from public.teacher_profiles where user_id=target for update;
  if not found then raise exception 'not_found'; end if;
  if profile.status<>'submitted' then raise exception 'conflict'; end if;
  if profile.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz then raise exception 'conflict'; end if;
  update public.teacher_profiles set status=case when payload->>'decision'='approve' then 'approved' else 'changes_requested' end,review_notes=payload->>'notes',updated_at=now() where user_id=target;
  insert into public.platform_reviews(reviewer_id,target_user_id,decision,notes) values(actor_id,target,payload->>'decision',payload->>'notes');
  return jsonb_build_object('ok',true);
 elsif action='report.resolve' then
  if not is_reviewer then raise exception 'forbidden'; end if;
  update public.coaching_reports set resolved_at=now(),resolved_by=actor_id,resolution=payload->>'resolution' where id=(payload->>'id')::uuid and resolved_at is null;
  if not found then raise exception 'conflict'; end if;
  return jsonb_build_object('ok',true);
 elsif action='create' then
  select * into profile from public.teacher_profiles where user_id=actor_id for share;
  if not found or profile.status<>'approved' then raise exception 'forbidden'; end if;
  insert into public.platform_lessons(teacher_id,teacher_name,request_id,document,contribution_license,license_version,training_opt_in)
  values(actor_id,profile.display_name,(payload->>'requestId')::uuid,payload->'document',(payload->>'contributionLicense')::boolean,payload->>'licenseVersion',coalesce((payload->>'trainingOptIn')::boolean,false)) returning id into new_id;
  return jsonb_build_object('ok',true,'lessonId',new_id);
 end if;

 target:=(payload->>'lessonId')::uuid;
 select * into lesson from public.platform_lessons where id=target for update;
 if not found then raise exception 'not_found'; end if;
 if action='reviewLesson' then
  if not is_reviewer or lesson.teacher_id=actor_id then raise exception 'forbidden'; end if;
  if lesson.status<>'submitted' or lesson.submitted_version_id is null then raise exception 'conflict'; end if;
  if lesson.submitted_version_id is distinct from (payload->>'expectedVersionId')::uuid then raise exception 'conflict'; end if;
  insert into public.platform_reviews(reviewer_id,lesson_id,version_id,decision,notes) values(actor_id,target,lesson.submitted_version_id,payload->>'decision',payload->>'notes');
  if payload->>'decision'='publish' then
   update public.platform_lessons set status='published',published_version_id=submitted_version_id,published_at=now(),review_notes=payload->>'notes',updated_at=now() where id=target;
  else update public.platform_lessons set status='changes_requested',review_notes=payload->>'notes',updated_at=now() where id=target;
  end if;
  return jsonb_build_object('ok',true);
 end if;

 select status into approved from public.teacher_profiles where user_id=actor_id;
 if lesson.teacher_id<>actor_id or approved is distinct from 'approved' then raise exception 'forbidden'; end if;
 if action='withdraw' then
  insert into public.platform_reviews(reviewer_id,lesson_id,version_id,decision,notes) values(actor_id,target,lesson.published_version_id,'withdraw','Teacher withdrew publication.');
  update public.platform_lessons set status='draft',published_version_id=null,published_at=null,submitted_version_id=null,updated_at=now() where id=target;
  return jsonb_build_object('ok',true);
 end if;
 if lesson.status='submitted' then raise exception 'conflict'; end if;
 if action='save' then
  update public.platform_lessons set document=payload->'document',transcript=payload->>'transcript',contribution_license=(payload->>'contributionLicense')::boolean,license_version=payload->>'licenseVersion',training_opt_in=(payload->>'trainingOptIn')::boolean,rights_recorded_at=now(),status='draft',updated_at=now() where id=target;
 elsif action='registerUpload' then
  if (payload->>'path') not like actor_id::text || '/' || target::text || '/%' then raise exception 'forbidden'; end if;
  insert into public.platform_uploads(path,teacher_id,lesson_id,size,content_type) values(payload->>'path',actor_id,target,(payload->>'size')::bigint,payload->>'contentType');
 elsif action='attach' then
  update public.platform_uploads set attached_at=now() where path=payload->>'path' and teacher_id=actor_id and lesson_id=target;
  if not found then raise exception 'forbidden'; end if;
  update public.platform_lessons set demo_path=payload->>'path',status='draft',updated_at=now() where id=target;
 elsif action='submit' then
  if lesson.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz then raise exception 'conflict'; end if;
  if lesson.demo_path is null or not lesson.contribution_license then raise exception 'conflict'; end if;
  insert into public.platform_lesson_versions(lesson_id,version,document,transcript,demo_path,teacher_name,contribution_license,license_version,training_opt_in)
  values(target,lesson.version+1,lesson.document,lesson.transcript,lesson.demo_path,lesson.teacher_name,lesson.contribution_license,lesson.license_version,lesson.training_opt_in) returning id into new_version;
  update public.platform_lessons set status='submitted',version=version+1,submitted_version_id=new_version,review_notes='',updated_at=now() where id=target;
 else raise exception 'forbidden';
 end if;
 return jsonb_build_object('ok',true);
end;
$$;
-- Not SECURITY DEFINER. Only the service role can execute; the API validates
-- actor identity with Auth.getUser and derives is_reviewer from its server env.
revoke all on function public.platform_mutate(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.platform_mutate(uuid,boolean,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-demonstrations','teacher-demonstrations',false,104857600,array['video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No browser Storage policy: signed upload capabilities are issued to approved
-- teachers for unique paths only; five-minute playback URLs are authorized by API.
commit;
