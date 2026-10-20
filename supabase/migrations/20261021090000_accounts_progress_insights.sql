begin;
-- 1. Lesson progress per account, so practice continues on another device.
create table public.learner_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_key text not null check(lesson_key ~ '^(builtin:[a-z]+|published:[a-f0-9-]{36}:v[0-9]{1,6})$'),
 data jsonb not null check(pg_column_size(data)<=20000),
 -- The browser's own change time decides which copy is newer.
 client_updated_at bigint not null check(client_updated_at>=0),
 updated_at timestamptz not null default now(),
 primary key(user_id,lesson_key)
);
create function public.progress_save(p_user uuid, p_key text, p_data jsonb, p_updated bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved public.learner_progress%rowtype;
begin
 insert into public.learner_progress(user_id,lesson_key,data,client_updated_at) values(p_user,p_key,p_data,p_updated)
 on conflict(user_id,lesson_key) do update set data=excluded.data,client_updated_at=excluded.client_updated_at,updated_at=now()
 where public.learner_progress.client_updated_at<excluded.client_updated_at;
 select * into saved from public.learner_progress where user_id=p_user and lesson_key=p_key;
 return jsonb_build_object('lessonKey',saved.lesson_key,'data',saved.data,'updatedAt',saved.client_updated_at);
end;
$$;

-- 2. Anonymous learning events for measuring whether lessons and coaching work.
-- No account, email, IP address, image or free text: a random per-browser ID only.
create table public.learning_events (
 id bigint generated always as identity primary key,
 session_id uuid,
 lesson_key text not null check(lesson_key ~ '^(builtin:[a-z]+|published:[a-f0-9-]{36}:v[0-9]{1,6})$'),
 kind text not null check(kind in ('lesson_start','step','lesson_complete','coach')),
 step integer check(step between 0 and 19),
 result text not null default '' check(result ~ '^[a-z_]{0,32}$'),
 created_at timestamptz not null default now()
);
create index learning_events_lesson on public.learning_events(lesson_key,created_at);
create index learning_events_created on public.learning_events(created_at);
create function public.learning_insights(since timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 with recent as (select * from public.learning_events where created_at>=since),
 lessons as (
  select lesson_key,
   count(distinct session_id) filter (where kind='lesson_start') as starts,
   count(distinct session_id) filter (where kind='lesson_complete') as completions,
   count(*) filter (where kind='coach') as coach_checks
  from recent group by lesson_key
 ),
 steps as (
  select lesson_key,step,
   count(distinct session_id) filter (where kind='step') as learners,
   count(*) filter (where kind='step' and result='camera_confirmed') as camera_confirmed,
   count(*) filter (where kind='step' and result='self_checked') as self_checked,
   count(*) filter (where kind='step' and result='unresolved') as unresolved,
   count(*) filter (where kind='coach' and result='looks_right') as looks_right,
   count(*) filter (where kind='coach' and result='adjust') as adjust,
   count(*) filter (where kind='coach' and result='unclear') as unclear,
   count(*) filter (where kind='coach' and result='not_verifiable') as not_verifiable,
   count(*) filter (where kind='coach' and result='stop') as stop
  from recent where step is not null group by lesson_key,step
 )
 select jsonb_build_object(
  'since',since,
  'learners',(select count(distinct session_id) from recent),
  'lessons',coalesce((select jsonb_agg(jsonb_build_object('lessonKey',l.lesson_key,'starts',l.starts,'completions',l.completions,'coachChecks',l.coach_checks,
   'steps',coalesce((select jsonb_agg(to_jsonb(s)-'lesson_key' order by s.step) from steps s where s.lesson_key=l.lesson_key),'[]'::jsonb)) order by l.starts desc) from lessons l),'[]'::jsonb)
 );
$$;

-- 3. Account deletion. Immutable history may only be removed by this function.
create or replace function public.platform_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('plsteach.erasure',true)='on' then return case when tg_op='DELETE' then old else new end; end if;
 raise exception 'immutable history';
end;
$$;
create or replace function public.training_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('plsteach.erasure',true)='on' then return case when tg_op='DELETE' then old else new end; end if;
 raise exception 'immutable history';
end;
$$;
-- Records an organization keeps after a member leaves no longer point at the deleted account.
alter table public.training_organizations alter column created_by drop not null;
alter table public.training_modules alter column created_by drop not null;
alter table public.training_module_versions alter column published_by drop not null;
alter table public.training_uploads alter column user_id drop not null;
alter table public.vision_models alter column trained_by drop not null;

create function public.account_delete(p_user uuid, p_email text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 membership record; other_admins integer; other_members integer;
 demo_paths text[] := '{}'; training_paths text[] := '{}'; supported uuid[];
begin
 if p_user is null then raise exception 'forbidden'; end if;
 perform set_config('plsteach.erasure','on',true);
 -- Organizations: a sole admin hands over first; an organization with nobody else is deleted.
 for membership in select id,organization_id,role from public.training_members where user_id=p_user and status<>'removed' loop
  select count(*) into other_members from public.training_members where organization_id=membership.organization_id and status<>'removed' and id<>membership.id;
  select count(*) into other_admins from public.training_members where organization_id=membership.organization_id and role='admin' and status='active' and id<>membership.id;
  if membership.role='admin' and other_admins=0 and other_members>0 then raise exception 'sole_admin'; end if;
  if other_members=0 then
   training_paths:=training_paths||array(select path from public.training_uploads where organization_id=membership.organization_id);
   delete from public.training_organizations where id=membership.organization_id;
  end if;
 end loop;
 delete from public.training_assignments where member_id in (select id from public.training_members where user_id=p_user);
 update public.training_members set user_id=null,status='removed',email='deleted-'||id::text||'@account.invalid',display_name='',invite_hash=null,invite_expires_at=null,updated_at=now() where user_id=p_user;
 update public.training_organizations set created_by=null where created_by=p_user;
 update public.training_modules set created_by=null where created_by=p_user;
 update public.training_module_versions set published_by=null where published_by=p_user;
 update public.training_uploads set user_id=null where user_id=p_user;
 -- Teacher content, including published versions and their reviews.
 demo_paths:=array(select path from public.platform_uploads where teacher_id=p_user or lesson_id in (select id from public.platform_lessons where teacher_id=p_user));
 delete from public.platform_reviews where lesson_id in (select id from public.platform_lessons where teacher_id=p_user)
  or version_id in (select v.id from public.platform_lesson_versions v join public.platform_lessons l on l.id=v.lesson_id where l.teacher_id=p_user)
  or reviewer_id=p_user;
 update public.platform_reviews set target_user_id=null where target_user_id=p_user;
 update public.platform_lessons set submitted_version_id=null,published_version_id=null where teacher_id=p_user;
 delete from public.platform_lesson_versions where lesson_id in (select id from public.platform_lessons where teacher_id=p_user);
 delete from public.platform_uploads where teacher_id=p_user or lesson_id in (select id from public.platform_lessons where teacher_id=p_user);
 delete from public.platform_lessons where teacher_id=p_user;
 delete from public.teacher_profiles where user_id=p_user;
 -- Community activity; support counts are recomputed for requests the account supported.
 supported:=array(select request_id from public.community_supports where user_id=p_user);
 delete from public.community_supports where user_id=p_user;
 delete from public.community_requests where user_id=p_user;
 update public.community_requests r set support_count=(select count(*) from public.community_supports s where s.request_id=r.id) where r.id=any(supported);
 -- Learning, coaching and model data.
 delete from public.coaching_trials where user_id=p_user;
 delete from public.learner_progress where user_id=p_user;
 delete from public.vision_clips where contributor_id=p_user;
 update public.vision_models set trained_by=null where trained_by=p_user;
 update public.vision_models set activated_by=null where activated_by=p_user;
 update public.coaching_reports set user_id=null where user_id=p_user;
 update public.coaching_reports set resolved_by=null where resolved_by=p_user;
 delete from public.training_pilot_access where email=lower(coalesce(p_email,''));
 -- Earlier sign-ups with the same address.
 if coalesce(p_email,'')<>'' then
  delete from public.waitlist where lower(email)=lower(p_email);
  delete from public.org_leads where lower(email)=lower(p_email);
 end if;
 return jsonb_build_object('demoPaths',to_jsonb(demo_paths),'trainingPaths',to_jsonb(training_paths));
end;
$$;

-- 4. Retention: what is removed automatically, and when.
create function public.retention_cleanup() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare demo_paths text[]; training_paths text[]; reports integer; events integer; shadow integer;
begin
 -- Feedback reports: 180 days after resolution, or a year after submission.
 delete from public.coaching_reports where (resolved_at is not null and resolved_at<now()-interval '180 days') or created_at<now()-interval '365 days';
 get diagnostics reports=row_count;
 -- Teacher videos: uploads never attached after 7 days; replaced ones no draft or version uses after 30 days.
 demo_paths:=array(select u.path from public.platform_uploads u where
  (u.attached_at is null and u.created_at<now()-interval '7 days')
  or (u.created_at<now()-interval '30 days' and not exists(select 1 from public.platform_lessons l where l.demo_path=u.path) and not exists(select 1 from public.platform_lesson_versions v where v.demo_path=u.path)));
 delete from public.platform_uploads where path=any(demo_paths);
 -- Organization files: unattached uploads after 7 days; files no module or version still uses after 30 days.
 training_paths:=array(select u.path from public.training_uploads u where
  (u.kind<>'frame' and u.attached_at is null and u.created_at<now()-interval '7 days')
  or (u.created_at<now()-interval '30 days'
   and not exists(select 1 from public.training_modules m where m.demo_path=u.path or m.manual_path=u.path or position(u.path in m.moments::text)>0 or position(u.path in m.document::text)>0)
   and not exists(select 1 from public.training_module_versions v where v.demo_path=u.path or position(u.path in v.document::text)>0)));
 delete from public.training_uploads where path=any(training_paths);
 delete from public.learning_events where created_at<now()-interval '400 days';
 get diagnostics events=row_count;
 delete from public.vision_shadow_checks where created_at<now()-interval '400 days';
 get diagnostics shadow=row_count;
 return jsonb_build_object('demoPaths',to_jsonb(demo_paths),'trainingPaths',to_jsonb(training_paths),'reports',reports,'events',events,'shadowChecks',shadow);
end;
$$;

-- 5. Organizations that may create a training workspace during the pilot.
create table public.training_pilot_access (
 email text primary key check(email=lower(email) and length(email) between 3 and 254),
 note text not null default '' check(length(note)<=200),
 added_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index training_pilot_added_by on public.training_pilot_access(added_by);

alter table public.learner_progress enable row level security;
alter table public.learning_events enable row level security;
alter table public.training_pilot_access enable row level security;
revoke all on public.learner_progress, public.learning_events, public.training_pilot_access from anon, authenticated;
grant select,insert,update,delete on public.learner_progress, public.training_pilot_access to service_role;
grant select,insert,delete on public.learning_events to service_role;
grant usage on sequence public.learning_events_id_seq to service_role;
-- The service role may now remove history, but the immutability triggers above still
-- refuse it unless account_delete has switched on erasure for its own transaction.
grant update,delete on public.platform_lesson_versions, public.platform_reviews to service_role;
grant update on public.training_module_versions to service_role;
grant delete on public.vision_shadow_checks to service_role;
revoke all on function public.progress_save(uuid,text,jsonb,bigint) from public,anon,authenticated;
revoke all on function public.learning_insights(timestamptz) from public,anon,authenticated;
revoke all on function public.account_delete(uuid,text) from public,anon,authenticated;
revoke all on function public.retention_cleanup() from public,anon,authenticated;
grant execute on function public.progress_save(uuid,text,jsonb,bigint) to service_role;
grant execute on function public.learning_insights(timestamptz) to service_role;
grant execute on function public.account_delete(uuid,text) to service_role;
grant execute on function public.retention_cleanup() to service_role;
commit;
