import { NextRequest } from 'next/server';
import { coachJson, limitedJson } from '@/lib/coaching-security';
import { logError } from '@/lib/log';
import { voiceAckSchema } from '@/lib/voice/contract';
import { announceStep, browserVoiceAuth } from '@/lib/voice/browser';
import { ackVoiceCommand } from '@/lib/voice/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Acknowledges a voice command once, with the step the lesson rules produced. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = browserVoiceAuth(request, (await params).id);
  if (auth instanceof Response) return auth;
  const body = await limitedJson(request, 512);
  if ('error' in body) return coachJson({ error: body.error }, 400);
  const parsed = voiceAckSchema.safeParse(body.data);
  if (!parsed.success) return coachJson({ error: 'validation' }, 400);
  try {
    const result = await ackVoiceCommand(auth.id, auth.browserHash, parsed.data.commandId, parsed.data.applied, parsed.data.step);
    if (result.result === 'not_found') return coachJson({ error: 'session' }, 404);
    if (result.result === 'applied' && result.step_changed && result.status !== 'ended') await announceStep(result.execution_id, result.lesson_key, result.step);
    return coachJson({ result: result.result, revision: result.revision, step: result.step });
  } catch (error) { logError('voice.ack_failed', {}, error); return coachJson({ error: 'storage' }, 503); }
}
