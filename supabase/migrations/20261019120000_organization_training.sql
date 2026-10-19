begin;
-- Organization training workspaces: private AI-guided modules, enrollment and
-- progress monitoring for schools, training providers and businesses.
create table public.training_organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 2 and 120),
 kind text not null check(kind in ('school','training_provider','business')),
 plan text not null check(plan in ('up-to-25','up-to-75','up-to-150','up-to-300')),
 seat_limit integer not null check(seat_limit in (25,75,150,300)),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index training_organizations_creator on public.training_organizations(created_by);
create table public.training_members (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.training_organizations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 email text not null check(email=lower(email) and length(email) between 3 and 254),
 display_name text not null default '',
 role text not null check(role in ('admin','instructor','learner')),
 status text not null check(status in ('invited','active','removed')),
 invite_hash text unique check(invite_hash is null or invite_hash ~ '^[a-f0-9]{64}$'),
 invite_expires_at timestamptz,
 invited_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), joined_at timestamptz, updated_at timestamptz not null default now(),
 unique(organization_id,email)
);
create unique index training_members_user on public.training_members(organization_id,user_id) where user_id is not null;
create index training_members_user_lookup on public.training_members(user_id);
create index training_members_inviter on public.training_members(invited_by);
create table public.training_modules (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.training_organizations(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 source text not null check(source in ('demonstration','manual','blank')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 document jsonb not null,
 source_text text not null default '' check(length(source_text)<=60000),
 moments jsonb not null default '[]'::jsonb check(jsonb_typeof(moments)='array' and jsonb_array_length(moments)<=12),
 demo_path text, manual_path text,
 audience text not null default 'all' check(audience in ('all','selected')),
 version integer not null default 0, published_version_id uuid, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index training_modules_org on public.training_modules(organization_id);
create index training_modules_creator on public.training_modules(created_by);
create table public.training_module_versions (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.training_modules(id) on delete cascade,
 organization_id uuid not null references public.training_organizations(id) on delete cascade,
 version integer not null, document jsonb not null, demo_path text,
 published_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(module_id,version)
);
create index training_versions_org on public.training_module_versions(organization_id);
create index training_versions_publisher on public.training_module_versions(published_by);
alter table public.training_modules add constraint training_published_version_fk foreign key(published_version_id) references public.training_module_versions(id);
create index training_modules_published on public.training_modules(published_version_id);
create table public.training_assignments (
 module_id uuid not null references public.training_modules(id) on delete cascade,
 member_id uuid not null references public.training_members(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(module_id,member_id)
);
create index training_assignments_member on public.training_assignments(member_id);
create table public.training_uploads (
 path text primary key,
 organization_id uuid not null references public.training_organizations(id) on delete cascade,
 module_id uuid not null references public.training_modules(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('demo','manual','frame')),
 size bigint not null check(size>0 and size<=104857600),
 content_type text not null check(content_type in ('video/mp4','video/webm','video/quicktime','application/pdf','image/jpeg')),
 attached_at timestamptz, created_at timestamptz not null default now()
);
create index training_uploads_org on public.training_uploads(organization_id);
create index training_uploads_module on public.training_uploads(module_id);
create index training_uploads_user on public.training_uploads(user_id);
create table public.training_progress (
 module_id uuid not null references public.training_modules(id) on delete cascade,
 member_id uuid not null references public.training_members(id) on delete cascade,
 organization_id uuid not null references public.training_organizations(id) on delete cascade,
 version integer not null check(version>0),
 step integer not null default 0 check(step>=0 and step<20),
 results jsonb not null,
 -- Camera confirmations are recorded only by the server after a high-confidence check.
 verified integer[] not null default '{}',
 completed_results jsonb,
 started_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 primary key(module_id,member_id)
);
create index training_progress_member on public.training_progress(member_id);
create index training_progress_org on public.training_progress(organization_id);

alter table public.training_organizations enable row level security;
alter table public.training_members enable row level security;
alter table public.training_modules enable row level security;
alter table public.training_module_versions enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_uploads enable row level security;
alter table public.training_progress enable row level security;
revoke all on public.training_organizations, public.training_members, public.training_modules, public.training_module_versions, public.training_assignments, public.training_uploads, public.training_progress from anon, authenticated;
grant select,insert,update,delete on public.training_organizations, public.training_members, public.training_modules, public.training_assignments, public.training_uploads, public.training_progress to service_role;
grant select,insert on public.training_module_versions to service_role;

create function public.training_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'immutable history'; end;
$$;
revoke all on function public.training_immutable() from public, anon, authenticated;
-- Published versions are what learners practiced and what progress refers to.
create trigger immutable_training_version before update on public.training_module_versions for each row execute function public.training_immutable();

create function public.training_mutate(actor_id uuid, actor_email text, payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 action text := payload->>'action';
 org public.training_organizations%rowtype; module public.training_modules%rowtype; member public.training_members%rowtype;
 org_id uuid; target uuid; actor_role text; actor_member uuid; new_id uuid; new_version uuid;
 seats integer; used integer; added integer := 0; skipped jsonb := '[]'::jsonb; invite jsonb; existing public.training_members%rowtype;
 version_doc jsonb; version_number integer; step_count integer; prior public.training_progress%rowtype; cleaned jsonb; verified integer[];
begin
 if actor_id is null then raise exception 'forbidden'; end if;
 if action='org.create' then
  seats:=case payload->>'plan' when 'up-to-25' then 25 when 'up-to-75' then 75 when 'up-to-150' then 150 when 'up-to-300' then 300 end;
  if seats is null or coalesce(actor_email,'')='' then raise exception 'forbidden'; end if;
  insert into public.training_organizations(name,kind,plan,seat_limit,created_by) values(payload->>'name',payload->>'kind',payload->>'plan',seats,actor_id) returning id into new_id;
  insert into public.training_members(organization_id,user_id,email,role,status,joined_at) values(new_id,actor_id,lower(actor_email),'admin','active',now());
  return jsonb_build_object('ok',true,'organizationId',new_id);
 elsif action='member.accept' then
  select * into member from public.training_members where invite_hash=payload->>'tokenHash' for update;
  if not found or member.status<>'invited' or member.invite_expires_at<now() then raise exception 'not_found'; end if;
  -- The invitation is personal: only the invited, verified email can accept it.
  if member.email<>lower(coalesce(actor_email,'')) then raise exception 'forbidden'; end if;
  if exists(select 1 from public.training_members where organization_id=member.organization_id and user_id=actor_id and id<>member.id and status<>'removed') then raise exception 'conflict'; end if;
  update public.training_members set user_id=null where organization_id=member.organization_id and user_id=actor_id and id<>member.id;
  update public.training_members set user_id=actor_id,status='active',invite_hash=null,invite_expires_at=null,joined_at=now(),updated_at=now() where id=member.id;
  return jsonb_build_object('ok',true,'organizationId',member.organization_id);
 end if;

 if payload ? 'moduleId' then
  target:=(payload->>'moduleId')::uuid;
  if action like 'progress.%' then select * into module from public.training_modules where id=target;
  else select * into module from public.training_modules where id=target for update; end if;
  if not found then raise exception 'not_found'; end if;
  org_id:=module.organization_id;
 else
  org_id:=(payload->>'organizationId')::uuid;
 end if;
 if action in ('org.plan','member.invite','member.update','member.remove') then select * into org from public.training_organizations where id=org_id for update;
 else select * into org from public.training_organizations where id=org_id; end if;
 if not found then raise exception 'not_found'; end if;
 select id,role into actor_member,actor_role from public.training_members where organization_id=org_id and user_id=actor_id and status='active';
 if actor_role is null then raise exception 'forbidden'; end if;
 used:=(select count(*) from public.training_members where organization_id=org_id and role='learner' and status in ('invited','active'));

 if action like 'progress.%' then
  if module.published_version_id is null then raise exception 'not_found'; end if;
  select document,version into version_doc,version_number from public.training_module_versions where id=module.published_version_id;
  if version_number<>(payload->>'version')::integer then raise exception 'conflict'; end if;
  -- Only assigned learners are tracked; admins and instructors may preview without a record.
  if actor_role<>'learner' then return jsonb_build_object('ok',true,'stored',false); end if;
  if module.audience='selected' and not exists(select 1 from public.training_assignments where module_id=target and member_id=actor_member) then raise exception 'forbidden'; end if;
  step_count:=jsonb_array_length(version_doc->'steps');
  select * into prior from public.training_progress where module_id=target and member_id=actor_member for update;
  if found and prior.version<>version_number then delete from public.training_progress where module_id=target and member_id=actor_member; prior:=null; end if;
  verified:=coalesce(prior.verified,'{}');
  if action='progress.verify' then
   if (payload->>'step')::integer>=step_count then raise exception 'conflict'; end if;
   verified:=array(select distinct unnest(verified||(payload->>'step')::integer) order by 1);
   insert into public.training_progress(module_id,member_id,organization_id,version,step,results,verified)
   values(target,actor_member,org_id,version_number,(payload->>'step')::integer,(select jsonb_agg(case when i-1=(payload->>'step')::integer then 'visual' else 'pending' end) from generate_series(1,step_count) i),verified)
   on conflict(module_id,member_id) do update set verified=excluded.verified,results=jsonb_set(public.training_progress.results,array[(payload->>'step')],'"visual"'),updated_at=now();
   return jsonb_build_object('ok',true);
  end if;
  if action<>'progress.save' then raise exception 'forbidden'; end if;
  if jsonb_array_length(payload->'results')<>step_count or (payload->>'step')::integer>=step_count then raise exception 'conflict'; end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'results') value where value not in ('pending','visual','manual','unresolved')) then raise exception 'conflict'; end if;
  -- A learner cannot claim a camera confirmation the server did not record.
  select jsonb_agg(case when item.value='visual' and not ((item.position-1)::integer=any(verified)) then 'manual' else item.value end order by item.position) into cleaned
  from jsonb_array_elements_text(payload->'results') with ordinality as item(value,position);
  insert into public.training_progress(module_id,member_id,organization_id,version,step,results,verified,completed_results,completed_at)
  values(target,actor_member,org_id,version_number,(payload->>'step')::integer,cleaned,verified,case when (payload->>'completed')::boolean then cleaned end,case when (payload->>'completed')::boolean then now() end)
  on conflict(module_id,member_id) do update set step=excluded.step,results=excluded.results,updated_at=now(),
   completed_results=case when (payload->>'completed')::boolean then excluded.results else public.training_progress.completed_results end,
   completed_at=case when (payload->>'completed')::boolean then coalesce(public.training_progress.completed_at,now()) else public.training_progress.completed_at end;
  return jsonb_build_object('ok',true,'stored',true,'results',cleaned);
 end if;

 if action='module.create' then
  if actor_role not in ('admin','instructor') then raise exception 'forbidden'; end if;
  if (select count(*) from public.training_modules where organization_id=org_id)>=200 then raise exception 'conflict'; end if;
  insert into public.training_modules(organization_id,created_by,source,document) values(org_id,actor_id,payload->>'source',payload->'document') returning id into new_id;
  return jsonb_build_object('ok',true,'moduleId',new_id);
 elsif action in ('module.save','module.moments','module.registerUpload','module.attach') then
  if actor_role not in ('admin','instructor') then raise exception 'forbidden'; end if;
  if action='module.save' then
   -- Step references may only point at stills captured for this module.
   if exists(select 1 from jsonb_array_elements(payload->'document'->'steps') step where step ? 'reference' and not exists(select 1 from public.training_uploads upload where upload.path=step->'reference'->>'frame' and upload.module_id=target and upload.kind='frame')) then raise exception 'forbidden'; end if;
   update public.training_modules set document=payload->'document',source_text=payload->>'sourceText',status=case when status='archived' then 'draft' else status end,updated_at=now() where id=target;
  elsif action='module.moments' then
   if exists(select 1 from jsonb_array_elements(payload->'moments') moment where moment->>'frame' not like org_id::text||'/'||target::text||'/frames/%') then raise exception 'forbidden'; end if;
   insert into public.training_uploads(path,organization_id,module_id,user_id,kind,size,content_type,attached_at)
   select upload->>'path',org_id,target,actor_id,'frame',(upload->>'size')::bigint,'image/jpeg',now() from jsonb_array_elements(payload->'uploads') upload
   on conflict(path) do nothing;
   if exists(select 1 from jsonb_array_elements(payload->'moments') moment where not exists(select 1 from public.training_uploads upload where upload.path=moment->>'frame' and upload.module_id=target)) then raise exception 'forbidden'; end if;
   update public.training_modules set moments=payload->'moments',updated_at=now() where id=target;
  elsif action='module.registerUpload' then
   if (payload->>'path') not like org_id::text||'/'||target::text||'/%' then raise exception 'forbidden'; end if;
   insert into public.training_uploads(path,organization_id,module_id,user_id,kind,size,content_type) values(payload->>'path',org_id,target,actor_id,payload->>'kind',(payload->>'size')::bigint,payload->>'contentType');
  else
   update public.training_uploads set attached_at=now() where path=payload->>'path' and module_id=target and kind=payload->>'kind';
   if not found then raise exception 'forbidden'; end if;
   if payload->>'kind'='demo' then update public.training_modules set demo_path=payload->>'path',updated_at=now() where id=target;
   else update public.training_modules set manual_path=payload->>'path',updated_at=now() where id=target; end if;
  end if;
  return jsonb_build_object('ok',true);
 end if;

 if actor_role<>'admin' then raise exception 'forbidden'; end if;
 if action='org.plan' then
  seats:=case payload->>'plan' when 'up-to-25' then 25 when 'up-to-75' then 75 when 'up-to-150' then 150 when 'up-to-300' then 300 end;
  if seats is null then raise exception 'forbidden'; end if;
  if used>seats then raise exception 'seats'; end if;
  update public.training_organizations set plan=payload->>'plan',seat_limit=seats,updated_at=now() where id=org_id;
 elsif action='member.invite' then
  for invite in select * from jsonb_array_elements(payload->'invites') loop
   select * into existing from public.training_members where organization_id=org_id and email=lower(invite->>'email') for update;
   if found and existing.status='active' then skipped:=skipped||to_jsonb(existing.email); continue; end if;
   if payload->>'role'='learner' and not (found and existing.status='invited' and existing.role='learner') then used:=used+1; end if;
   if found and existing.status='invited' and existing.role='learner' and payload->>'role'<>'learner' then used:=used-1; end if;
   insert into public.training_members(organization_id,email,role,status,invite_hash,invite_expires_at,invited_by)
   values(org_id,lower(invite->>'email'),payload->>'role','invited',invite->>'tokenHash',now()+interval '30 days',actor_id)
   on conflict(organization_id,email) do update set role=excluded.role,status='invited',invite_hash=excluded.invite_hash,invite_expires_at=excluded.invite_expires_at,invited_by=actor_id,updated_at=now();
   added:=added+1;
  end loop;
  if used>org.seat_limit then raise exception 'seats'; end if;
  return jsonb_build_object('ok',true,'added',added,'skipped',skipped);
 elsif action in ('member.update','member.remove') then
  select * into member from public.training_members where id=(payload->>'memberId')::uuid and organization_id=org_id for update;
  if not found or member.status='removed' then raise exception 'not_found'; end if;
  -- An organization always keeps at least one active admin.
  if member.role='admin' and member.status='active' and (action='member.remove' or payload->>'role'<>'admin') and (select count(*) from public.training_members where organization_id=org_id and role='admin' and status='active')<=1 then raise exception 'conflict'; end if;
  if action='member.remove' then
   update public.training_members set status='removed',invite_hash=null,invite_expires_at=null,updated_at=now() where id=member.id;
   delete from public.training_assignments where member_id=member.id;
  else
   if payload->>'role'='learner' and member.role<>'learner' and used+1>org.seat_limit then raise exception 'seats'; end if;
   update public.training_members set role=payload->>'role',updated_at=now() where id=member.id;
  end if;
 elsif action='module.publish' then
  if module.document is null or jsonb_array_length(module.document->'steps')=0 then raise exception 'conflict'; end if;
  insert into public.training_module_versions(module_id,organization_id,version,document,demo_path,published_by)
  values(target,org_id,module.version+1,module.document,module.demo_path,actor_id) returning id into new_version;
  update public.training_modules set status='published',version=version+1,published_version_id=new_version,published_at=now(),audience=payload->>'audience',updated_at=now() where id=target;
 elsif action='module.archive' then
  update public.training_modules set status='archived',published_version_id=null,published_at=null,updated_at=now() where id=target;
  delete from public.training_assignments where module_id=target;
 elsif action<>'module.assign' then raise exception 'forbidden';
 end if;
 if action in ('module.publish','module.assign') then
  if exists(select 1 from jsonb_array_elements_text(payload->'memberIds') chosen where not exists(select 1 from public.training_members where id=chosen::uuid and organization_id=org_id and status<>'removed')) then raise exception 'forbidden'; end if;
  update public.training_modules set audience=payload->>'audience' where id=target;
  delete from public.training_assignments where module_id=target;
  if payload->>'audience'='selected' then
   insert into public.training_assignments(module_id,member_id) select target,chosen::uuid from jsonb_array_elements_text(payload->'memberIds') chosen on conflict do nothing;
  end if;
 end if;
 return jsonb_build_object('ok',true);
end;
$$;
-- Not SECURITY DEFINER. The API verifies the account with Auth.getUser and
-- passes its verified email; only the service role can execute this function.
revoke all on function public.training_mutate(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.training_mutate(uuid,text,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('organization-training','organization-training',false,104857600,array['video/mp4','video/webm','video/quicktime','application/pdf','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
