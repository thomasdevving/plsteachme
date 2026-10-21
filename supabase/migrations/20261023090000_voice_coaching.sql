-- Voice coaching with Bolna: a server-owned session per call, bound to the learner, the
-- lesson and the Bolna execution. It holds the current step, a monotonically increasing
-- state revision, the latest server-validated camera assessment, an explicit voice-minute
-- allowance, a deduplicated command queue for the browser and deduplicated webhooks.
-- No audio or transcript is stored here.
begin;

-- 1. Voice minutes per account, reserved before a call and reconciled from Bolna's
-- execution record afterwards. A reservation that is never reconciled stays counted.
create table public.voice_allowances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reserved_seconds integer not null default 0 check (reserved_seconds >= 0),
  used_seconds integer not null default 0 check (used_seconds >= 0)
);
-- A service-wide daily cap on voice seconds: an emergency brake on spend.
create table public.voice_daily_usage (
  day date primary key,
  seconds integer not null default 0 check (seconds >= 0)
);

create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trial_id uuid not null,
  lesson_key text not null check (lesson_key ~ '^builtin:[a-z]{2,20}$'),
  content_version integer not null check (content_version > 0),
  step_count integer not null check (step_count between 1 and 20),
  step integer not null check (step >= 0),
  revision bigint not null default 1 check (revision > 0),
  status text not null default 'starting' check (status in ('starting', 'active', 'paused', 'ended')),
  end_reason text check (end_reason ~ '^[a-z_]{1,30}$'),
  execution_id text unique check (execution_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  tool_token_hash text not null check (tool_token_hash ~ '^[a-f0-9]{64}$'),
  browser_token_hash text not null check (browser_token_hash ~ '^[a-f0-9]{64}$'),
  reserved_seconds integer not null check (reserved_seconds > 0),
  used_seconds integer check (used_seconds >= 0),
  reconciled_at timestamptz,
  observation jsonb,
  observed_at timestamptz,
  last_event_key text check (length(last_event_key) <= 120),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  check (step < step_count)
);
-- One open voice session per account, so two tabs cannot run two calls.
create unique index voice_sessions_one_open on public.voice_sessions(user_id) where status <> 'ended';
create index voice_sessions_unreconciled on public.voice_sessions(created_at) where reconciled_at is null;

-- Actions requested by the voice agent, applied by the learner's browser through the
-- existing lesson rules. One command per action and state revision, so a retried tool
-- call cannot apply an action twice.
create table public.voice_commands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_sessions(id) on delete cascade,
  action text not null check (action in ('next', 'back', 'replay', 'pause', 'resume', 'check', 'stop')),
  expected_revision bigint not null,
  step integer not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'declined', 'stale')),
  created_at timestamptz not null default now(),
  acked_at timestamptz,
  unique (session_id, action, expected_revision)
);
create index voice_commands_pending on public.voice_commands(session_id, created_at) where status = 'pending';

-- Webhook deliveries already processed (a one-way hash of execution, status and time).
create table public.voice_webhook_deliveries (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now()
);

-- Reserves the call's maximum duration, then opens the session. An open session that the
-- browser stopped polling (a closed tab) is replaced; a live one makes the start 'busy'.
create function public.voice_session_start(p_user_id uuid, p_trial_id uuid, p_lesson_key text, p_content_version integer,
  p_step_count integer, p_step integer, p_max_seconds integer, p_allowance_seconds integer, p_daily_limit_seconds integer,
  p_tool_token_hash text, p_browser_token_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare allowance public.voice_allowances; open_session public.voice_sessions; created public.voice_sessions; today integer;
begin
  if p_max_seconds <= 0 or p_step < 0 or p_step >= p_step_count then raise exception 'invalid voice session'; end if;
  insert into public.voice_allowances(user_id) values (p_user_id) on conflict do nothing;
  select * into allowance from public.voice_allowances where user_id = p_user_id for update;
  select * into open_session from public.voice_sessions where user_id = p_user_id and status <> 'ended' for update;
  if found then
    if open_session.expires_at > now() and open_session.last_seen_at > now() - interval '25 seconds' then
      return jsonb_build_object('result', 'busy');
    end if;
    update public.voice_sessions set status = 'ended', end_reason = 'abandoned', ended_at = now(), observation = null
      where id = open_session.id;
    update public.voice_commands set status = 'stale' where session_id = open_session.id and status = 'pending';
  end if;
  if p_allowance_seconds - allowance.used_seconds - allowance.reserved_seconds < p_max_seconds then
    return jsonb_build_object('result', 'allowance', 'remaining_seconds',
      greatest(0, p_allowance_seconds - allowance.used_seconds - allowance.reserved_seconds));
  end if;
  insert into public.voice_daily_usage(day) values (current_date) on conflict do nothing;
  select seconds into today from public.voice_daily_usage where day = current_date for update;
  if today + p_max_seconds > p_daily_limit_seconds then return jsonb_build_object('result', 'daily'); end if;
  update public.voice_daily_usage set seconds = seconds + p_max_seconds where day = current_date;
  update public.voice_allowances set reserved_seconds = reserved_seconds + p_max_seconds where user_id = p_user_id;
  insert into public.voice_sessions(user_id, trial_id, lesson_key, content_version, step_count, step, tool_token_hash,
    browser_token_hash, reserved_seconds, expires_at)
  values (p_user_id, p_trial_id, p_lesson_key, p_content_version, p_step_count, p_step, p_tool_token_hash,
    p_browser_token_hash, p_max_seconds, now() + make_interval(secs => p_max_seconds + 90))
  returning * into created;
  return jsonb_build_object('result', 'ok', 'session', jsonb_build_object('id', created.id, 'step', created.step,
    'revision', created.revision, 'expires_at', created.expires_at, 'reserved_seconds', created.reserved_seconds,
    'remaining_seconds', p_allowance_seconds - allowance.used_seconds - allowance.reserved_seconds - p_max_seconds));
end;
$$;

-- Binds the Bolna execution ID returned by the server-side session mint.
create function public.voice_session_bind(p_session_id uuid, p_user_id uuid, p_execution_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.voice_sessions set execution_id = p_execution_id, status = 'active'
    where id = p_session_id and user_id = p_user_id and status = 'starting' and execution_id is null;
  return found;
end;
$$;

-- Refunds a reservation in full; only for a call that never connected.
create function public.voice_session_release(p_session_id uuid, p_user_id uuid, p_reason text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions;
begin
  select * into s from public.voice_sessions where id = p_session_id and user_id = p_user_id and reconciled_at is null for update;
  if not found then return false; end if;
  update public.voice_sessions set status = 'ended', end_reason = p_reason, ended_at = coalesce(ended_at, now()),
    used_seconds = 0, reconciled_at = now(), observation = null where id = s.id;
  update public.voice_allowances set reserved_seconds = greatest(0, reserved_seconds - s.reserved_seconds) where user_id = s.user_id;
  update public.voice_daily_usage set seconds = greatest(0, seconds - s.reserved_seconds) where day = s.created_at::date;
  return true;
end;
$$;

-- Ends a session from the learner's browser. The reservation stays until reconciliation.
create function public.voice_session_end(p_session_id uuid, p_browser_token_hash text, p_reason text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.voice_sessions set status = 'ended', end_reason = p_reason, ended_at = now(), observation = null
    where id = p_session_id and browser_token_hash = p_browser_token_hash and status <> 'ended';
  if found then
    update public.voice_commands set status = 'stale' where session_id = p_session_id and status = 'pending';
  end if;
  return found;
end;
$$;

-- Ends sessions past their maximum duration and marks their pending commands stale.
create function public.voice_expire(p_session_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.voice_sessions set status = 'ended', end_reason = 'expired', ended_at = now(), observation = null
    where id = p_session_id and status <> 'ended' and expires_at <= now();
  if found then update public.voice_commands set status = 'stale' where session_id = p_session_id and status = 'pending'; end if;
end;
$$;

-- The session state a tool call may read, only with the session's tool token.
create function public.voice_tool_session(p_session_id uuid, p_tool_token_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions;
begin
  perform public.voice_expire(p_session_id);
  select * into s from public.voice_sessions where id = p_session_id and tool_token_hash = p_tool_token_hash;
  if not found then return null; end if;
  return jsonb_build_object('id', s.id, 'lesson_key', s.lesson_key, 'content_version', s.content_version, 'step', s.step,
    'step_count', s.step_count, 'revision', s.revision, 'status', s.status, 'observation', s.observation,
    'observed_at', s.observed_at, 'now', now(), 'expires_at', s.expires_at);
end;
$$;

-- Queues an action for the browser at the current revision. p_step is the step the agent
-- believes is current; a mismatch only ever rejects. Duplicates return the first command.
create function public.voice_command_enqueue(p_session_id uuid, p_tool_token_hash text, p_action text, p_step integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions; command public.voice_commands; duplicate boolean := false;
begin
  perform public.voice_expire(p_session_id);
  select * into s from public.voice_sessions where id = p_session_id and tool_token_hash = p_tool_token_hash for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if s.status = 'ended' then return jsonb_build_object('result', 'ended'); end if;
  if s.status = 'starting' then return jsonb_build_object('result', 'not_ready'); end if;
  if p_step is not null and p_step <> s.step then
    return jsonb_build_object('result', 'stale', 'step', s.step, 'revision', s.revision);
  end if;
  if s.status = 'paused' and p_action not in ('resume', 'stop') then
    return jsonb_build_object('result', 'paused', 'step', s.step, 'revision', s.revision);
  end if;
  update public.voice_commands set status = 'stale'
    where session_id = s.id and status = 'pending' and expected_revision < s.revision;
  insert into public.voice_commands(session_id, action, expected_revision, step)
    values (s.id, p_action, s.revision, s.step) on conflict (session_id, action, expected_revision) do nothing
    returning * into command;
  if not found then
    duplicate := true;
    select * into command from public.voice_commands where session_id = s.id and action = p_action and expected_revision = s.revision;
  end if;
  return jsonb_build_object('result', 'queued', 'duplicate', duplicate, 'command_id', command.id, 'status', command.status,
    'step', s.step, 'revision', s.revision);
end;
$$;

-- The browser's poll: a heartbeat plus the commands for the current revision.
create function public.voice_poll(p_session_id uuid, p_browser_token_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions;
begin
  perform public.voice_expire(p_session_id);
  update public.voice_sessions set last_seen_at = now()
    where id = p_session_id and browser_token_hash = p_browser_token_hash and status <> 'ended'
    returning * into s;
  if not found then
    select * into s from public.voice_sessions where id = p_session_id and browser_token_hash = p_browser_token_hash;
    if not found then return null; end if;
    return jsonb_build_object('status', 'ended', 'end_reason', s.end_reason, 'commands', '[]'::jsonb);
  end if;
  update public.voice_commands set status = 'stale'
    where session_id = s.id and status = 'pending' and expected_revision < s.revision;
  return jsonb_build_object('status', s.status, 'step', s.step, 'revision', s.revision, 'expires_at', s.expires_at,
    'commands', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'action', c.action, 'revision', c.expected_revision,
      'step', c.step) order by c.created_at) from public.voice_commands c
      where c.session_id = s.id and c.status = 'pending' and c.expected_revision = s.revision), '[]'::jsonb));
end;
$$;

-- Acknowledges a command once. Only a command for the current revision can apply; every
-- applied command advances the revision, so later commands for the old state go stale.
create function public.voice_command_ack(p_session_id uuid, p_browser_token_hash text, p_command_id uuid, p_applied boolean, p_step integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions; c public.voice_commands; next_status text; next_step integer;
begin
  select * into s from public.voice_sessions where id = p_session_id and browser_token_hash = p_browser_token_hash for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  select * into c from public.voice_commands where id = p_command_id and session_id = s.id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if c.status <> 'pending' then
    return jsonb_build_object('result', case when c.status = 'stale' then 'stale' else 'duplicate' end, 'status', c.status,
      'revision', s.revision, 'step', s.step);
  end if;
  if s.status = 'ended' or c.expected_revision <> s.revision then
    update public.voice_commands set status = 'stale', acked_at = now() where id = c.id;
    return jsonb_build_object('result', 'stale', 'revision', s.revision, 'step', s.step);
  end if;
  if not p_applied then
    update public.voice_commands set status = 'declined', acked_at = now() where id = c.id;
    return jsonb_build_object('result', 'declined', 'revision', s.revision, 'step', s.step);
  end if;
  next_step := coalesce(p_step, s.step);
  if next_step < 0 or next_step >= s.step_count then raise exception 'invalid step'; end if;
  next_status := case c.action when 'pause' then 'paused' when 'resume' then 'active' when 'stop' then 'ended' else s.status end;
  update public.voice_commands set status = 'applied', acked_at = now() where id = c.id;
  update public.voice_sessions set revision = revision + 1, step = next_step, status = next_status,
    end_reason = case when next_status = 'ended' then 'voice_stop' else end_reason end,
    ended_at = case when next_status = 'ended' then now() else ended_at end,
    observation = case when next_step <> s.step or next_status = 'ended' then null else observation end,
    observed_at = case when next_step <> s.step then null else observed_at end,
    last_event_key = case when next_step <> s.step then null else last_event_key end
    where id = s.id;
  update public.voice_commands set status = 'stale' where session_id = s.id and status = 'pending';
  return jsonb_build_object('result', 'applied', 'revision', s.revision + 1, 'step', next_step, 'status', next_status,
    'step_changed', next_step <> s.step, 'execution_id', s.execution_id, 'lesson_key', s.lesson_key);
end;
$$;

-- The learner moved with the lesson controls, restarted, or paused or resumed with the
-- on-screen voice controls. Earlier observations and pending commands no longer apply.
create function public.voice_session_state(p_session_id uuid, p_browser_token_hash text, p_step integer, p_restart boolean, p_paused boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions; next_status text; step_changed boolean;
begin
  select * into s from public.voice_sessions where id = p_session_id and browser_token_hash = p_browser_token_hash for update;
  if not found then return null; end if;
  if s.status = 'ended' then return jsonb_build_object('result', 'ended'); end if;
  if p_step < 0 or p_step >= s.step_count then raise exception 'invalid step'; end if;
  next_status := case when p_paused is null or s.status not in ('active', 'paused') then s.status
    when p_paused then 'paused' else 'active' end;
  step_changed := p_step <> s.step or p_restart;
  if not step_changed and next_status = s.status then
    return jsonb_build_object('result', 'unchanged', 'revision', s.revision, 'step', s.step, 'status', s.status);
  end if;
  update public.voice_sessions set step = p_step, status = next_status, revision = revision + 1,
    observation = case when step_changed then null else observation end,
    observed_at = case when step_changed then null else observed_at end,
    last_event_key = case when step_changed then null else last_event_key end
    where id = s.id;
  update public.voice_commands set status = 'stale' where session_id = s.id and status = 'pending';
  return jsonb_build_object('result', 'changed', 'revision', s.revision + 1, 'step', p_step, 'status', next_status,
    'step_changed', step_changed, 'execution_id', s.execution_id, 'lesson_key', s.lesson_key);
end;
$$;

-- Records a camera assessment the server just produced for the session's current step.
-- Returns whether it is new enough to announce (a different event key than the last one).
create function public.voice_observe(p_session_id uuid, p_browser_token_hash text, p_lesson_key text, p_step integer, p_observation jsonb, p_event_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions; announce boolean;
begin
  perform public.voice_expire(p_session_id);
  select * into s from public.voice_sessions where id = p_session_id and browser_token_hash = p_browser_token_hash for update;
  if not found then return jsonb_build_object('recorded', false, 'reason', 'not_found'); end if;
  if s.status <> 'active' then return jsonb_build_object('recorded', false, 'reason', s.status); end if;
  if p_lesson_key <> s.lesson_key or p_step <> s.step then return jsonb_build_object('recorded', false, 'reason', 'stale'); end if;
  announce := p_event_key is not null and p_event_key is distinct from s.last_event_key;
  update public.voice_sessions set observation = p_observation || jsonb_build_object('step', s.step, 'revision', s.revision),
    observed_at = now(), last_event_key = case when announce then p_event_key else last_event_key end
    where id = s.id;
  return jsonb_build_object('recorded', true, 'announce', announce, 'execution_id', s.execution_id, 'revision', s.revision,
    'step', s.step);
end;
$$;

-- Webhook deduplication: true only for the first delivery of a key.
create function public.voice_webhook_seen(p_key text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.voice_webhook_deliveries(key) values (p_key) on conflict do nothing;
  return found;
end;
$$;

-- Releases a claimed delivery whose processing failed, so Bolna's retry is handled.
create function public.voice_webhook_forget(p_key text)
returns void language sql security invoker set search_path = '' as $$
  delete from public.voice_webhook_deliveries where key = p_key;
$$;

-- Replaces a session's reservation with the duration from Bolna's execution record. Once only.
create function public.voice_session_reconcile(p_execution_id text, p_used_seconds integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare s public.voice_sessions;
begin
  if p_used_seconds < 0 then raise exception 'invalid duration'; end if;
  select * into s from public.voice_sessions where execution_id = p_execution_id for update;
  if not found then return 'not_found'; end if;
  if s.reconciled_at is not null then return 'duplicate'; end if;
  update public.voice_sessions set used_seconds = p_used_seconds, reconciled_at = now(),
    status = 'ended', end_reason = coalesce(end_reason, 'call_ended'), ended_at = coalesce(ended_at, now()), observation = null
    where id = s.id;
  update public.voice_commands set status = 'stale' where session_id = s.id and status = 'pending';
  update public.voice_allowances set reserved_seconds = greatest(0, reserved_seconds - s.reserved_seconds),
    used_seconds = used_seconds + p_used_seconds where user_id = s.user_id;
  update public.voice_daily_usage set seconds = greatest(0, seconds - s.reserved_seconds + p_used_seconds)
    where day = s.created_at::date;
  return 'ok';
end;
$$;

-- Retention: ended sessions keep only accounting fields; old commands and delivery keys go.
create function public.voice_cleanup()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare commands integer; deliveries integer; expired integer;
begin
  update public.voice_sessions set status = 'ended', end_reason = 'expired', ended_at = now(), observation = null
    where status <> 'ended' and expires_at <= now();
  get diagnostics expired = row_count;
  delete from public.voice_commands c using public.voice_sessions s
    where c.session_id = s.id and s.status = 'ended' and s.ended_at < now() - interval '1 day';
  get diagnostics commands = row_count;
  delete from public.voice_webhook_deliveries where received_at < now() - interval '14 days';
  get diagnostics deliveries = row_count;
  delete from public.voice_daily_usage where day < current_date - 400;
  return jsonb_build_object('expiredSessions', expired, 'commands', commands, 'webhookKeys', deliveries);
end;
$$;

alter table public.voice_allowances enable row level security;
alter table public.voice_daily_usage enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.voice_commands enable row level security;
alter table public.voice_webhook_deliveries enable row level security;
revoke all on public.voice_allowances, public.voice_daily_usage, public.voice_sessions, public.voice_commands,
  public.voice_webhook_deliveries from anon, authenticated;
grant select, insert, update, delete on public.voice_allowances, public.voice_daily_usage, public.voice_sessions,
  public.voice_commands, public.voice_webhook_deliveries to service_role;
revoke all on function public.voice_session_start(uuid, uuid, text, integer, integer, integer, integer, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.voice_session_bind(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.voice_session_release(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.voice_session_end(uuid, text, text) from public, anon, authenticated;
revoke all on function public.voice_expire(uuid) from public, anon, authenticated;
revoke all on function public.voice_tool_session(uuid, text) from public, anon, authenticated;
revoke all on function public.voice_command_enqueue(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.voice_poll(uuid, text) from public, anon, authenticated;
revoke all on function public.voice_command_ack(uuid, text, uuid, boolean, integer) from public, anon, authenticated;
revoke all on function public.voice_session_state(uuid, text, integer, boolean, boolean) from public, anon, authenticated;
revoke all on function public.voice_observe(uuid, text, text, integer, jsonb, text) from public, anon, authenticated;
revoke all on function public.voice_webhook_seen(text) from public, anon, authenticated;
revoke all on function public.voice_webhook_forget(text) from public, anon, authenticated;
revoke all on function public.voice_session_reconcile(text, integer) from public, anon, authenticated;
revoke all on function public.voice_cleanup() from public, anon, authenticated;
grant execute on function public.voice_session_start(uuid, uuid, text, integer, integer, integer, integer, integer, integer, text, text) to service_role;
grant execute on function public.voice_session_bind(uuid, uuid, text) to service_role;
grant execute on function public.voice_session_release(uuid, uuid, text) to service_role;
grant execute on function public.voice_session_end(uuid, text, text) to service_role;
grant execute on function public.voice_expire(uuid) to service_role;
grant execute on function public.voice_tool_session(uuid, text) to service_role;
grant execute on function public.voice_command_enqueue(uuid, text, text, integer) to service_role;
grant execute on function public.voice_poll(uuid, text) to service_role;
grant execute on function public.voice_command_ack(uuid, text, uuid, boolean, integer) to service_role;
grant execute on function public.voice_session_state(uuid, text, integer, boolean, boolean) to service_role;
grant execute on function public.voice_observe(uuid, text, text, integer, jsonb, text) to service_role;
grant execute on function public.voice_webhook_seen(text) to service_role;
grant execute on function public.voice_webhook_forget(text) to service_role;
grant execute on function public.voice_session_reconcile(text, integer) to service_role;
grant execute on function public.voice_cleanup() to service_role;
commit;
