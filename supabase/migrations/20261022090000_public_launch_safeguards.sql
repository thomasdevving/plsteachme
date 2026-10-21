-- Safeguards for the public test phase: a bounded free session, a daily AI budget,
-- shared rate limits, one free session per email address, and hiding of community requests.
begin;

-- 1. The free session ends after a number of AI checks or a time limit, enforced here
-- under the trial's row lock, so no client report can extend it.
alter table public.coaching_trials add column ai_calls integer not null default 0 check (ai_calls >= 0);

create function public.coaching_trial_use(p_user_id uuid, p_session_id uuid, p_max_calls integer, p_max_minutes integer)
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

-- 2. One free session per email address, also after the account is deleted.
-- Only a one-way hash of the lowercased address is kept.
create table public.trial_claims (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz not null default now()
);
insert into public.trial_claims(email_hash)
  select encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex')
  from public.coaching_trials t join auth.users u on u.id = t.user_id
  where coalesce(u.email, '') <> ''
  on conflict do nothing;

drop function public.claim_coaching_trial(uuid, text, integer);
create function public.claim_coaching_trial(p_user_id uuid, p_skill_id text, p_total_steps integer, p_email text)
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

-- 3. A daily cap on all AI calls across the service: an emergency brake on spend.
create table public.ai_usage (
  day date not null,
  kind text not null check (kind ~ '^[a-z._]{1,40}$'),
  calls integer not null default 0 check (calls >= 0),
  primary key (day, kind)
);
create function public.ai_budget_use(p_kind text, p_daily_limit integer)
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

-- 4. Rate limits shared by every server instance (fixed windows).
create table public.rate_limits (
  key text primary key check (length(key) between 1 and 120),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0)
);
create function public.rate_hit(p_key text, p_max integer, p_window_seconds integer)
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
create function public.ephemeral_cleanup()
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

-- 5. Reviewers can hide a community request; hidden requests are not listed publicly.
alter table public.community_requests
  add column hidden_at timestamptz,
  add column hidden_by uuid references auth.users(id) on delete set null;
create index community_requests_visible on public.community_requests(support_count desc) where hidden_at is null;

alter table public.trial_claims enable row level security;
alter table public.ai_usage enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.trial_claims, public.ai_usage, public.rate_limits from anon, authenticated;
grant select, insert, delete on public.trial_claims to service_role;
grant select, insert, update, delete on public.ai_usage, public.rate_limits to service_role;
revoke all on function public.coaching_trial_use(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_coaching_trial(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.ai_budget_use(text, integer) from public, anon, authenticated;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.ephemeral_cleanup() from public, anon, authenticated;
grant execute on function public.coaching_trial_use(uuid, uuid, integer, integer) to service_role;
grant execute on function public.claim_coaching_trial(uuid, text, integer, text) to service_role;
grant execute on function public.ai_budget_use(text, integer) to service_role;
grant execute on function public.rate_hit(text, integer, integer) to service_role;
grant execute on function public.ephemeral_cleanup() to service_role;
commit;
