-- One durable entitlement per auth account. No client can insert, reset, or delete it.
create table public.coaching_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  skill_id text not null,
  total_steps integer not null check (total_steps > 0 and total_steps <= 100),
  completed_steps integer not null default 0 check (completed_steps >= 0 and completed_steps <= total_steps),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.coaching_trials enable row level security;
revoke all on public.coaching_trials from anon, authenticated;
grant select on public.coaching_trials to authenticated;
grant all on public.coaching_trials to service_role;
create policy "Read own trial" on public.coaching_trials for select to authenticated using ((select auth.uid()) = user_id);

-- The unique account key and transaction lock make concurrent starts idempotent.
-- Only the server's service role can call these functions with a verified user ID.
create function public.claim_coaching_trial(p_user_id uuid, p_skill_id text, p_total_steps integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare trial public.coaching_trials;
begin
  insert into public.coaching_trials(user_id, skill_id, total_steps)
  values(p_user_id, p_skill_id, p_total_steps) on conflict (user_id) do nothing;
  select * into trial from public.coaching_trials where user_id = p_user_id for update;
  return to_jsonb(trial) - 'user_id';
end;
$$;
create function public.advance_coaching_trial(p_user_id uuid, p_session_id uuid, p_completed_steps integer)
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
revoke all on function public.claim_coaching_trial(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.advance_coaching_trial(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_coaching_trial(uuid, text, integer) to service_role;
grant execute on function public.advance_coaching_trial(uuid, uuid, integer) to service_role;
