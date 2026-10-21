import 'server-only';
import { fetchWithTimeout } from '../network';
import { bolnaSessionSchema, type BolnaSession } from './contract';
import { voiceSettings } from './config';

export class BolnaError extends Error {
  constructor(public status: number, public code: 'at_capacity' | 'provider', public scope?: string) { super(code); }
}
const headers = () => ({ Authorization: `Bearer ${voiceSettings().apiKey}`, 'Content-Type': 'application/json' });

/**
 * Mints Bolna's short-lived, single-use web-call session with the server's API key.
 * Only the documented session fields are passed on to the browser.
 */
export async function mintWebCallSession(userData: Record<string, string | number | boolean>): Promise<BolnaSession> {
  const s = voiceSettings();
  for (const [index, path] of s.sessionPaths.entries()) {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${s.apiBase}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify({ agent_id: s.agentId, user_data: userData }) }, 12_000);
    } catch { throw new BolnaError(502, 'provider'); }
    if (response.status === 404 && index < s.sessionPaths.length - 1) continue;
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (response.status === 429) throw new BolnaError(429, 'at_capacity', typeof body?.scope === 'string' ? body.scope.slice(0, 20) : undefined);
    if (!response.ok) throw new BolnaError(502, 'provider');
    const parsed = bolnaSessionSchema.safeParse(body);
    if (!parsed.success) throw new BolnaError(502, 'provider');
    return parsed.data;
  }
  throw new BolnaError(502, 'provider');
}

/**
 * Publishes an event to a live call (Graph Agent event edges). 'accepted' means Bolna
 * queued it; it does not prove the agent spoke, which may wait for current speech to end.
 */
export async function injectEvent(runId: string, event: 'camera_result' | 'step_changed', properties: Record<string, string | number>) {
  const s = voiceSettings();
  try {
    const response = await fetchWithTimeout(`${s.apiBase}/v1/call/${encodeURIComponent(runId)}/events`, { method: 'POST', headers: headers(), body: JSON.stringify({ event, properties }) }, 4_000);
    return response.ok ? 'accepted' : response.status === 404 ? 'no_call' : 'failed';
  } catch { return 'failed'; }
}

const TERMINAL = new Set(['completed', 'no-answer', 'busy', 'failed', 'canceled', 'stopped', 'error', 'balance-low']);
export const isTerminalStatus = (status: string) => TERMINAL.has(status);

/** Reads the execution record with the server's key; this, not a webhook body, is trusted for usage. */
export async function fetchExecution(id: string): Promise<{ status: string; seconds: number | null }> {
  const s = voiceSettings();
  const response = await fetchWithTimeout(`${s.apiBase}/executions/${encodeURIComponent(id)}`, { headers: headers() }, 10_000);
  if (!response.ok) throw new BolnaError(502, 'provider');
  const data = await response.json() as { status?: unknown; conversation_duration?: unknown; telephony_data?: { duration?: unknown } | null };
  const status = typeof data.status === 'string' ? data.status : '';
  const durations = [data.conversation_duration, data.telephony_data?.duration].map(Number).filter(n => Number.isFinite(n) && n >= 0);
  return { status, seconds: durations.length ? Math.ceil(Math.max(...durations)) : null };
}
