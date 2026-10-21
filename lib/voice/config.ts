import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { authConfig } from '../auth/config';
import { mockMode } from '../storage';
import { clientIp } from '../client-ip';

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback;
};
const secret = (value: string | undefined) => { const v = value?.trim() || ''; return v.length >= 24 ? v : ''; };

/** Server-only Bolna and voice-allowance settings. Nothing here reaches the browser. */
export function voiceSettings() {
  const env = process.env;
  const path = env.BOLNA_WEB_CALL_SESSION_PATH?.trim();
  return {
    apiKey: env.BOLNA_API_KEY?.trim() || '',
    agentId: env.BOLNA_AGENT_ID?.trim() || '',
    toolSecret: secret(env.BOLNA_TOOL_SECRET),
    webhookSecret: secret(env.BOLNA_WEBHOOK_SECRET),
    apiBase: (env.BOLNA_API_BASE?.trim() || 'https://api.bolna.ai').replace(/\/$/, ''),
    // Bolna's current docs name /web-call/session; the SDK's own example uses the
    // earlier /web-call/freeswitch-session. A 404 on the first falls back to the second.
    sessionPaths: path ? [path] : ['/web-call/session', '/web-call/freeswitch-session'],
    // 'graph': a Graph Agent with event edges, so camera results are announced.
    // 'tools': any agent; the coach fetches the latest camera check when asked.
    events: env.BOLNA_AGENT_MODE?.trim() !== 'tools',
    // Must equal the agent's own Total Call Timeout (call_terminate), which Bolna enforces.
    maxCallSeconds: int(env.VOICE_MAX_CALL_SECONDS, 300, 60, 1800),
    allowanceSeconds: int(env.VOICE_ALLOWANCE_MINUTES, 15, 1, 600) * 60,
    dailySeconds: int(env.VOICE_DAILY_MINUTE_LIMIT, 240, 1, 100_000) * 60,
    sourceIps: (env.BOLNA_SOURCE_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean),
  };
}

export function voiceConfigured() {
  const s = voiceSettings();
  return Boolean(s.apiKey && s.agentId && s.toolSecret && s.webhookSecret && !mockMode && authConfig().enabled);
}

function same(supplied: string, expected: string) {
  const a = createHash('sha256').update(supplied).digest(), b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Bolna signs neither tool calls nor webhooks. Its documented trust mechanisms are its
 * fixed source IPs and the headers configured on the agent, so both are checked here.
 */
export function fromBolna(request: Request, kind: 'tool' | 'webhook') {
  const s = voiceSettings();
  const expected = kind === 'tool' ? s.toolSecret : s.webhookSecret;
  if (!expected) return false;
  // The agent API has no webhook header field, so the webhook also accepts the secret as
  // ?key=; the dashboard's "Add headers" option is preferred because URLs are logged more often.
  const supplied = kind === 'tool' ? request.headers.get('authorization') || ''
    : request.headers.get('x-plsteach-webhook-secret') || new URL(request.url).searchParams.get('key') || '';
  if (!same(supplied, kind === 'tool' ? `Bearer ${expected}` : expected)) return false;
  return !s.sourceIps.length || s.sourceIps.includes(clientIp(request));
}
