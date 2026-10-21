import 'server-only';
import { db, mockMode } from './storage';
import { logError } from './log';

// Limits for the public test phase, enforced in the database so they hold across
// every server instance. Provider-side spend limits remain the final backstop.
const number = (value: string | undefined, fallback: number) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback; };
export const aiLimits = () => ({
  dailyCalls: number(process.env.AI_DAILY_CALL_LIMIT, 3000),
  trialCalls: number(process.env.TRIAL_MAX_AI_CALLS, 150),
  trialMinutes: number(process.env.TRIAL_MAX_MINUTES, 120),
});

/** Counts one AI call against today's service-wide budget. Fails closed: spend is never unbounded. */
export async function aiBudgetAllowed(kind: string): Promise<boolean> {
  if (mockMode) return true;
  try {
    const { data, error } = await db().rpc('ai_budget_use', { p_kind: kind, p_daily_limit: aiLimits().dailyCalls });
    if (error) throw error;
    if (data !== true) logError('ai.budget_exhausted', { kind });
    return data === true;
  } catch (error) { logError('ai.budget_check_failed', { kind }, error); return false; }
}

/** Shared fixed-window rate limit. Fails open (with a log line): the budget above still caps spend. */
export async function sharedRateAllowed(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (mockMode) return true;
  try {
    const { data, error } = await db().rpc('rate_hit', { p_key: key.slice(0, 120), p_max: max, p_window_seconds: windowSeconds });
    if (error) throw error;
    return data === true;
  } catch (error) { logError('rate_limit.check_failed', { key: key.split(':')[0] }, error); return true; }
}

/** Counts one AI call against a free session. 'exhausted' ends the session for good. */
export async function trialAiUse(userId: string, sessionId: string): Promise<'ok' | 'missing' | 'completed' | 'exhausted' | 'error'> {
  try {
    const { trialCalls, trialMinutes } = aiLimits();
    const { data, error } = await db().rpc('coaching_trial_use', { p_user_id: userId, p_session_id: sessionId, p_max_calls: trialCalls, p_max_minutes: trialMinutes });
    if (error) throw error;
    return ['ok', 'missing', 'completed', 'exhausted'].includes(data) ? data : 'error';
  } catch (error) { logError('trial.use_failed', {}, error); return 'error'; }
}
