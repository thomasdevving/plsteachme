begin;

create table public.account_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text unique check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
 first_name text not null default '' check (length(first_name)<=80),
 last_name text not null default '' check (length(last_name)<=80),
 has_avatar boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.account_profiles enable row level security;
revoke all on public.account_profiles from public, anon, authenticated;
grant select on public.account_profiles to authenticated;
grant select,insert,update,delete on public.account_profiles to service_role;
create policy "Read own account profile" on public.account_profiles for select to authenticated
 using ((select auth.uid())=user_id);

-- Older accounts keep their identity, progress and trial; usernames are claimed in account settings.
insert into public.account_profiles(user_id,first_name,last_name)
 select id,left(coalesce(to_jsonb(u)->'raw_user_meta_data'->>'first_name',''),80),
 left(coalesce(to_jsonb(u)->'raw_user_meta_data'->>'last_name',''),80) from auth.users u;

-- Reserving the username is part of the auth-user transaction: concurrent signups cannot claim it twice.
create function public.create_account_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare meta jsonb; handle text;
begin
 meta:=coalesce(to_jsonb(new)->'raw_user_meta_data','{}'::jsonb);
 handle:=lower(trim(meta->>'username'));
 if handle is not null and handle !~ '^[a-z0-9_]{3,24}$' then handle:=null; end if;
 insert into public.account_profiles(user_id,username,first_name,last_name)
 values(new.id,handle,left(coalesce(meta->>'first_name',''),80),left(coalesce(meta->>'last_name',''),80));
 return new;
end;
$$;
revoke all on function public.create_account_profile() from public,anon,authenticated;
create trigger create_account_profile after insert on auth.users
 for each row execute function public.create_account_profile();

-- Only the server may resolve a username to an email; the browser never receives the mapping.
create function public.account_login_email(p_username text) returns text
language sql stable security definer set search_path='' as $$
 select u.email from public.account_profiles p join auth.users u on u.id=p.user_id
 where p.username=lower(trim(p_username)) limit 1;
$$;
revoke all on function public.account_login_email(text) from public,anon,authenticated;
grant execute on function public.account_login_email(text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-avatars','profile-avatars',false,262144,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=262144,allowed_mime_types=array['image/jpeg'];

commit;
