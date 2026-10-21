import 'server-only';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { coachJson, sameOrigin } from '../coaching-security';
import { hash } from '../storage';
import { logError } from '../log';
import { VOICE_TOKEN_HEADER } from './contract';
import { voiceConfigured, voiceSettings } from './config';
import { injectEvent } from './bolna';
import { skillFromLessonKey, stepChangedProperties } from './lesson';

const id = z.uuid();
const secret = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);
/**
 * The browser side of a voice session is authorized by the session's own token, which
 * only the signed-in learner who started it received. It never reaches Bolna.
 */
export function browserVoiceAuth(request: NextRequest, sessionId: string): { id: string; browserHash: string } | Response {
  if (!sameOrigin(request)) return coachJson({ error: 'origin' }, 403);
  if (!voiceConfigured()) return coachJson({ error: 'unavailable' }, 503);
  const parsedId = id.safeParse(sessionId), parsedToken = secret.safeParse(request.headers.get(VOICE_TOKEN_HEADER));
  if (!parsedId.success || !parsedToken.success) return coachJson({ error: 'session' }, 401);
  return { id: parsedId.data, browserHash: hash(parsedToken.data) };
}

/** Lets a Graph Agent introduce the new step. Accepted does not mean it was spoken. */
export async function announceStep(executionId: string | null | undefined, lessonKey: string, step: number) {
  const skill = skillFromLessonKey(lessonKey);
  if (!executionId || !skill || !voiceSettings().events) return 'skipped';
  try {
    const result = await injectEvent(executionId, 'step_changed', await stepChangedProperties(skill, step));
    if (result === 'failed') logError('voice.event_failed', { event: 'step_changed' });
    return result;
  } catch (error) { logError('voice.event_failed', { event: 'step_changed' }, error); return 'failed'; }
}
