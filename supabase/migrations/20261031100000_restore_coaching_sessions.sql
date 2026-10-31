-- Restore the server-side coaching prerequisites in the Worker's Supabase project.
-- Safe to rerun against the expected schema. Does not reset sessions or counters.
-- Apply in Supabase SQL Editor; this performs no OpenAI calls.
begin;
create table if not exists public.coaching_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  skill_id text not null,
  total_steps integer not null check (total_steps > 0 and total_steps <= 100),
  completed_steps integer not null default 0 check (completed_steps >= 0 and completed_steps <= total_steps),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.coaching_trials add column if not exists ai_calls integer not null default 0 check(ai_calls>=0);

create or replace function public.coaching_trial_use(p_user_id uuid, p_session_id uuid, p_max_calls integer, p_max_minutes integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare trial public.coaching_trials;
begin
  select * into trial from public.coaching_trials where user_id = p_user_id and id = p_session_id for update;
  if not found then return 'missing'; end if;
  if trial.completed_at is not null then return 'completed'; end if;
  if trial.ai_calls >= p_max_calls or trial.started_at < now() - make_interval(mins => p_max_minutes) then
    update public.coaching_trials set completed_at = now() where user_id = p_user_id;
    return 'exhausted';
  end if;
  update public.coaching_trials set ai_calls = ai_calls + 1 where user_id = p_user_id;
  return 'ok';
end;
$$;

create table if not exists public.trial_claims (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz not null default now()
);
insert into public.trial_claims(email_hash)
  select encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex')
  from public.coaching_trials t join auth.users u on u.id = t.user_id
  where coalesce(u.email, '') <> ''
  on conflict do nothing;

drop function if exists public.claim_coaching_trial(uuid, text, integer);
create or replace function public.claim_coaching_trial(p_user_id uuid, p_skill_id text, p_total_steps integer, p_email text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare trial public.coaching_trials; fresh boolean := true;
begin
  if not exists (select 1 from public.coaching_trials where user_id = p_user_id) and coalesce(p_email, '') <> '' then
    insert into public.trial_claims(email_hash)
      values (encode(sha256(convert_to(lower(p_email), 'UTF8')), 'hex')) on conflict do nothing;
    fresh := found;
  end if;
  -- An address that already used its free session starts with a completed one.
  insert into public.coaching_trials(user_id, skill_id, total_steps, completed_at)
  values (p_user_id, p_skill_id, p_total_steps, case when fresh then null else now() end)
  on conflict (user_id) do nothing;
  select * into trial from public.coaching_trials where user_id = p_user_id for update;
  return to_jsonb(trial) - 'user_id';
end;
$$;

create or replace function public.advance_coaching_trial(p_user_id uuid, p_session_id uuid, p_completed_steps integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare trial public.coaching_trials;
begin
  update public.coaching_trials
  set completed_steps = greatest(completed_steps, least(p_completed_steps, total_steps)),
      completed_at = case when p_completed_steps >= total_steps then coalesce(completed_at, now()) else completed_at end
  where user_id = p_user_id and id = p_session_id and p_completed_steps >= 0
  returning * into trial;
  if not found then return null; end if;
  return to_jsonb(trial) - 'user_id';
end;
$$;
create table if not exists public.ai_usage (
  day date not null,
  kind text not null check (kind ~ '^[a-z._]{1,40}$'),
  calls integer not null default 0 check (calls >= 0),
  primary key (day, kind)
);
create or replace function public.ai_budget_use(p_kind text, p_daily_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare total integer;
begin
  select coalesce(sum(calls), 0) into total from public.ai_usage where day = current_date;
  if total >= p_daily_limit then return false; end if;
  insert into public.ai_usage(day, kind, calls) values (current_date, p_kind, 1)
  on conflict (day, kind) do update set calls = public.ai_usage.calls + 1;
  return true;
end;
$$;

create table if not exists public.rate_limits (
  key text primary key check (length(key) between 1 and 120),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0)
);
create or replace function public.rate_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  insert into public.rate_limits as r(key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into n;
  return n <= p_max;
end;
$$;
create or replace function public.ephemeral_cleanup()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare limits integer; usage integer;
begin
  delete from public.rate_limits where window_start < now() - interval '2 days';
  get diagnostics limits = row_count;
  delete from public.ai_usage where day < current_date - 400;
  get diagnostics usage = row_count;
  return jsonb_build_object('rateLimits', limits, 'aiUsageDays', usage);
end;
$$;


alter table public.coaching_trials enable row level security;
alter table public.trial_claims enable row level security;
alter table public.ai_usage enable row level security;
alter table public.rate_limits enable row level security;
grant usage on schema public to service_role;
-- Preserve any existing authenticated SELECT policy, including its MFA restriction.
revoke all on public.coaching_trials from public,anon;
revoke insert,update,delete,truncate,references,trigger on public.coaching_trials from authenticated;
revoke all on public.trial_claims,public.ai_usage,public.rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.coaching_trials,public.ai_usage,public.rate_limits to service_role;
grant select,insert,delete on public.trial_claims to service_role;
revoke all on function public.claim_coaching_trial(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.claim_coaching_trial(uuid,text,integer,text) to service_role;
revoke all on function public.advance_coaching_trial(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.advance_coaching_trial(uuid,uuid,integer) to service_role;
revoke all on function public.coaching_trial_use(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.coaching_trial_use(uuid,uuid,integer,integer) to service_role;
revoke all on function public.ai_budget_use(text,integer) from public,anon,authenticated;
grant execute on function public.ai_budget_use(text,integer) to service_role;
revoke all on function public.rate_hit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.rate_hit(text,integer,integer) to service_role;
revoke all on function public.ephemeral_cleanup() from public,anon,authenticated;
grant execute on function public.ephemeral_cleanup() to service_role;
notify pgrst, 'reload schema';
commit;
