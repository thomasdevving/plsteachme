import { NextRequest } from 'next/server';
import { coachJson, coachingRateAllowed, limitedJson, sameOrigin } from '@/lib/coaching-security';
import { trialAccess } from '@/lib/auth/trial';
import { builtinTrialId } from '@/lib/auth/trial-reference';
import { modules } from '@/lib/modules';
import { LESSON_CONTENT_VERSION } from '@/lib/learning-progress';
import { hash, token } from '@/lib/storage';
import { logError } from '@/lib/log';
import { voiceStartSchema } from '@/lib/voice/contract';
import { voiceConfigured, voiceSettings } from '@/lib/voice/config';
import { BolnaError, mintWebCallSession } from '@/lib/voice/bolna';
import { voiceLessonKey, voiceUserData } from '@/lib/voice/lesson';
import { bindVoiceSession, releaseVoiceSession, startVoiceSession } from '@/lib/voice/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export function GET() {
  const s = voiceSettings();
  return coachJson({ available: voiceConfigured(), provider: 'Bolna', maxCallSeconds: s.maxCallSeconds, allowanceMinutes: s.allowanceSeconds / 60 });
}

/**
 * Starts a voice coaching call: checks the learner's account and free session for this
 * lesson, reserves the call's maximum duration, then mints Bolna's single-use browser
 * session server-side and binds its execution ID to an opaque coaching session.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return coachJson({ error: 'origin' }, 403);
  if (!voiceConfigured()) return coachJson({ error: 'unavailable' }, 503);
  if (!coachingRateAllowed(request, 'voice')) return coachJson({ error: 'rate' }, 429, { 'Retry-After': '600' });
  const body = await limitedJson(request, 1024);
  if ('error' in body) return coachJson({ error: body.error }, body.error === 'size' ? 413 : 400);
  const parsed = voiceStartSchema.safeParse(body.data);
  if (!parsed.success) return coachJson({ error: 'validation' }, 400);
  const { skill, step } = parsed.data;
  const stepCount = modules[skill].steps.length;
  if (step >= stepCount) return coachJson({ error: 'validation' }, 400);
  const access = await trialAccess(request, builtinTrialId(skill));
  if (access instanceof Response) return access;
  const settings = voiceSettings();
  const toolToken = token(), browserToken = token();
  const started = await startVoiceSession({ userId: access.user.id, trialId: access.trial.id, lessonKey: voiceLessonKey(skill), contentVersion: LESSON_CONTENT_VERSION, stepCount, step, maxSeconds: settings.maxCallSeconds, allowanceSeconds: settings.allowanceSeconds, dailySeconds: settings.dailySeconds, toolHash: hash(toolToken), browserHash: hash(browserToken) })
    .catch(error => { logError('voice.start_failed', {}, error); return null; });
  if (!started) return coachJson({ error: 'storage' }, 503);
  if (started.result === 'busy') return coachJson({ error: 'busy' }, 409);
  if (started.result === 'allowance') return coachJson({ error: 'allowance', remainingSeconds: started.remaining_seconds }, 403);
  if (started.result === 'daily') return coachJson({ error: 'daily' }, 503);
  const sessionId = started.session.id;
  let minted;
  try {
    // The tool token is how this call's tool requests prove which session they belong to.
    // Bolna keeps user_data with the call record; the token stops working when the session ends.
    minted = await mintWebCallSession({ voice_session: sessionId, voice_token: toolToken, ...await voiceUserData(skill, step, stepCount) });
  } catch (error) {
    await releaseVoiceSession(sessionId, access.user.id, 'mint_failed').catch(() => {});
    if (error instanceof BolnaError && error.code === 'at_capacity') return coachJson({ error: 'at_capacity', scope: error.scope }, 429, { 'Retry-After': '30' });
    logError('voice.mint_failed', {}, error);
    return coachJson({ error: 'provider' }, 502);
  }
  try {
    if (!await bindVoiceSession(sessionId, access.user.id, minted.run_id)) return coachJson({ error: 'busy' }, 409);
  } catch (error) { logError('voice.bind_failed', {}, error); return coachJson({ error: 'storage' }, 503); }
  return coachJson({
    session: minted,
    voice: { id: sessionId, token: browserToken, step: started.session.step, revision: started.session.revision, maxSeconds: started.session.reserved_seconds, remainingSeconds: started.session.remaining_seconds, events: settings.events }
  });
}
