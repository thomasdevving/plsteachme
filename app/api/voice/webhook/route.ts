import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { coachJson, limitedJson } from '@/lib/coaching-security';
import { logError } from '@/lib/log';
import { fromBolna, voiceConfigured } from '@/lib/voice/config';
import { fetchExecution, isTerminalStatus } from '@/lib/voice/bolna';
import { reconcileVoiceSession, webhookForget, webhookSeen } from '@/lib/voice/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Bolna's execution webhook (agent Extractions tab, with the shared secret as a custom
// header). The payload is only a trigger: usage comes from the execution record fetched
// with the server's API key. Transcripts and recordings in the payload are never stored.
const delivery = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/), status: z.string().max(40), updated_at: z.string().max(60).optional() }).loose();

export async function POST(request: NextRequest) {
  if (!voiceConfigured()) return coachJson({ error: 'unavailable' }, 503);
  if (!fromBolna(request, 'webhook')) return coachJson({ error: 'unauthorized' }, 401);
  const body = await limitedJson(request, 1_000_000);
  if ('error' in body) return coachJson({ error: body.error }, body.error === 'size' ? 413 : 400);
  const parsed = delivery.safeParse(body.data);
  if (!parsed.success) return coachJson({ error: 'validation' }, 400);
  const { id, status, updated_at } = parsed.data;
  if (!isTerminalStatus(status)) return coachJson({ ok: true, ignored: true });
  const key = createHash('sha256').update(`${id}:${status}:${updated_at ?? ''}`).digest('hex');
  let claimed = false;
  try {
    // The first delivery of a key claims it; repeats do no work. A failed attempt releases
    // its claim so Bolna's retry is processed. Reconciliation is also once-only per call.
    if (!await webhookSeen(key)) return coachJson({ ok: true, duplicate: true });
    claimed = true;
    const execution = await fetchExecution(id);
    if (!isTerminalStatus(execution.status) || execution.status === 'completed' && execution.seconds === null) {
      await webhookForget(key);
      return coachJson({ ok: true, pending: true });
    }
    const result = await reconcileVoiceSession(id, execution.seconds ?? 0);
    return coachJson({ ok: true, result, duplicate: result === 'duplicate' });
  } catch (error) {
    if (claimed) await webhookForget(key).catch(() => {});
    logError('voice.webhook_failed', {}, error);
    return coachJson({ error: 'unavailable' }, 503);
  }
}
