-- Targeted repair for a project where the progress-sync readiness checks fail.
-- Run in the project configured as the Cloudflare Worker's SUPABASE_URL.
-- Safe to rerun against the expected schema: existing users and progress remain.
-- Only the server service role can read or write this private account data.
begin;
-- 1. Lesson progress per account, so practice continues on another device.
create table if not exists public.learner_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_key text not null check(lesson_key ~ '^(builtin:[a-z]+|published:[a-f0-9-]{36}:v[0-9]{1,6})$'),
 data jsonb not null check(pg_column_size(data)<=20000),
 -- The browser's own change time decides which copy is newer.
 client_updated_at bigint not null check(client_updated_at>=0),
 updated_at timestamptz not null default now(),
 primary key(user_id,lesson_key)
);
create or replace function public.progress_save(p_user uuid, p_key text, p_data jsonb, p_updated bigint) returns jsonb
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

alter table public.learner_progress enable row level security;
revoke all on public.learner_progress from public,anon,authenticated;
grant usage on schema public to service_role;
grant select,insert,update,delete on public.learner_progress to service_role;
revoke all on function public.progress_save(uuid,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.progress_save(uuid,text,jsonb,bigint) to service_role;

-- Make the restored table/function discoverable immediately through Supabase's API.
notify pgrst, 'reload schema';
commit;
