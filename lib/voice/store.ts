import 'server-only';
import { db } from '../storage';
import type { CoachFeedback } from '../coaching-contract';

// Thin wrappers over the voice functions in supabase/migrations/*_voice_coaching.sql.
// Every state change happens inside one database function under a row lock.
export class VoiceStoreError extends Error {}
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw new VoiceStoreError(name);
  return data as T;
}

export type StartResult =
  | { result: 'ok'; session: { id: string; step: number; revision: number; expires_at: string; reserved_seconds: number; remaining_seconds: number } }
  | { result: 'busy' }
  | { result: 'daily' }
  | { result: 'allowance'; remaining_seconds: number };
export const startVoiceSession = (input: { userId: string; trialId: string; lessonKey: string; contentVersion: number; stepCount: number; step: number; maxSeconds: number; allowanceSeconds: number; dailySeconds: number; toolHash: string; browserHash: string }) =>
  call<StartResult>('voice_session_start', { p_user_id: input.userId, p_trial_id: input.trialId, p_lesson_key: input.lessonKey, p_content_version: input.contentVersion, p_step_count: input.stepCount, p_step: input.step, p_max_seconds: input.maxSeconds, p_allowance_seconds: input.allowanceSeconds, p_daily_limit_seconds: input.dailySeconds, p_tool_token_hash: input.toolHash, p_browser_token_hash: input.browserHash });
export const bindVoiceSession = (id: string, userId: string, executionId: string) => call<boolean>('voice_session_bind', { p_session_id: id, p_user_id: userId, p_execution_id: executionId });
export const releaseVoiceSession = (id: string, userId: string, reason: string) => call<boolean>('voice_session_release', { p_session_id: id, p_user_id: userId, p_reason: reason });
export const endVoiceSession = (id: string, browserHash: string, reason: string) => call<boolean>('voice_session_end', { p_session_id: id, p_browser_token_hash: browserHash, p_reason: reason });

export type ToolSession = { id: string; lesson_key: string; content_version: number; step: number; step_count: number; revision: number; status: 'starting' | 'active' | 'paused' | 'ended'; observation: (CoachFeedback & { step: number; revision: number }) | null; observed_at: string | null; now: string; expires_at: string };
export const toolSession = (id: string, toolHash: string) => call<ToolSession | null>('voice_tool_session', { p_session_id: id, p_tool_token_hash: toolHash });
export type EnqueueResult = { result: 'queued'; duplicate: boolean; command_id: string; status: string; step: number; revision: number } | { result: 'stale' | 'paused'; step: number; revision: number } | { result: 'not_found' | 'ended' | 'not_ready' };
export const enqueueVoiceCommand = (id: string, toolHash: string, action: string, step: number | null) => call<EnqueueResult>('voice_command_enqueue', { p_session_id: id, p_tool_token_hash: toolHash, p_action: action, p_step: step });

export const pollVoiceSession = (id: string, browserHash: string) => call<Record<string, unknown> | null>('voice_poll', { p_session_id: id, p_browser_token_hash: browserHash });
export type AckResult = { result: 'applied'; revision: number; step: number; status: string; step_changed: boolean; execution_id: string | null; lesson_key: string } | { result: 'stale' | 'declined' | 'duplicate'; revision: number; step: number } | { result: 'not_found' };
export const ackVoiceCommand = (id: string, browserHash: string, commandId: string, applied: boolean, step: number | null) => call<AckResult>('voice_command_ack', { p_session_id: id, p_browser_token_hash: browserHash, p_command_id: commandId, p_applied: applied, p_step: step });
export type StateResult = { result: 'changed'; revision: number; step: number; status: string; step_changed: boolean; execution_id: string | null; lesson_key: string } | { result: 'unchanged'; revision: number; step: number; status: string } | { result: 'ended' } | null;
export const setVoiceState = (id: string, browserHash: string, step: number, restart: boolean, paused: boolean | null) => call<StateResult>('voice_session_state', { p_session_id: id, p_browser_token_hash: browserHash, p_step: step, p_restart: restart, p_paused: paused });
export type ObserveResult = { recorded: false; reason: string } | { recorded: true; announce: boolean; execution_id: string | null; revision: number; step: number };
export const observeVoice = (id: string, browserHash: string, lessonKey: string, step: number, observation: CoachFeedback, eventKey: string | null) => call<ObserveResult>('voice_observe', { p_session_id: id, p_browser_token_hash: browserHash, p_lesson_key: lessonKey, p_step: step, p_observation: observation, p_event_key: eventKey });

export const webhookSeen = (key: string) => call<boolean>('voice_webhook_seen', { p_key: key });
export const webhookForget = (key: string) => call<void>('voice_webhook_forget', { p_key: key });
export const reconcileVoiceSession = (executionId: string, seconds: number) => call<'ok' | 'duplicate' | 'not_found'>('voice_session_reconcile', { p_execution_id: executionId, p_used_seconds: seconds });
