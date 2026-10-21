import { NextRequest } from 'next/server';
import { coachJson, limitedJson } from '@/lib/coaching-security';
import { logError } from '@/lib/log';
import { voiceEndSchema, voiceStateSchema } from '@/lib/voice/contract';
import { announceStep, browserVoiceAuth } from '@/lib/voice/browser';
import { endVoiceSession, pollVoiceSession, setVoiceState } from '@/lib/voice/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The browser's heartbeat: session status and the commands for the current revision. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = browserVoiceAuth(request, (await params).id);
  if (auth instanceof Response) return auth;
  try {
    const data = await pollVoiceSession(auth.id, auth.browserHash);
    return data ? coachJson(data) : coachJson({ error: 'session' }, 404);
  } catch (error) { logError('voice.poll_failed', {}, error); return coachJson({ error: 'storage' }, 503); }
}

/** The learner moved with the lesson controls, restarted, or paused or resumed voice coaching. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = browserVoiceAuth(request, (await params).id);
  if (auth instanceof Response) return auth;
  const body = await limitedJson(request, 256);
  if ('error' in body) return coachJson({ error: body.error }, 400);
  const parsed = voiceStateSchema.safeParse(body.data);
  if (!parsed.success) return coachJson({ error: 'validation' }, 400);
  try {
    const result = await setVoiceState(auth.id, auth.browserHash, parsed.data.step, parsed.data.restart, parsed.data.paused);
    if (!result) return coachJson({ error: 'session' }, 404);
    if (result.result === 'ended') return coachJson({ error: 'ended' }, 410);
    if (result.result === 'changed' && result.step_changed && result.status === 'active') await announceStep(result.execution_id, result.lesson_key, result.step);
    return coachJson({ revision: result.revision, step: result.step, status: result.status });
  } catch (error) { logError('voice.state_failed', {}, error); return coachJson({ error: 'storage' }, 503); }
}

/** Ends the session from the browser. The call itself is hung up by the browser SDK. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = browserVoiceAuth(request, (await params).id);
  if (auth instanceof Response) return auth;
  const body = await limitedJson(request, 256);
  const parsed = voiceEndSchema.safeParse('data' in body ? body.data : null);
  try {
    await endVoiceSession(auth.id, auth.browserHash, parsed.success ? parsed.data.reason : 'stopped');
    return coachJson({ stopped: true });
  } catch (error) { logError('voice.end_failed', {}, error); return coachJson({ error: 'storage' }, 503); }
}
