import 'server-only';
import { z } from 'zod';
import type { SkillId } from '../config';
import type { CoachFeedback } from '../coaching-contract';
import { hash } from '../storage';
import { logError } from '../log';
import { VOICE_SESSION_HEADER, VOICE_TOKEN_HEADER } from './contract';
import { voiceConfigured, voiceSettings } from './config';
import { injectEvent } from './bolna';
import { cameraEventKey, cameraEventProperties, voiceLessonKey } from './lesson';
import { observeVoice } from './store';

const id = z.uuid(), secret = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);
/**
 * Called by the camera check route with feedback the server itself just produced, never
 * a verdict from the browser. Records it on the learner's voice session for the same
 * lesson and step and, once per result, tells a Graph Agent about it. Never throws: a
 * voice problem must not break the camera check.
 */
export async function recordVoiceObservation(request: Request, skill: SkillId, step: number, feedback: CoachFeedback) {
  const sessionId = id.safeParse(request.headers.get(VOICE_SESSION_HEADER)), token = secret.safeParse(request.headers.get(VOICE_TOKEN_HEADER));
  if (!sessionId.success || !token.success || !voiceConfigured()) return 'skipped';
  try {
    const key = cameraEventKey(step, feedback);
    const observed = await observeVoice(sessionId.data, hash(token.data), voiceLessonKey(skill), step, feedback, key);
    if (!observed.recorded) return 'stale';
    if (!observed.announce || !observed.execution_id || !voiceSettings().events) return 'recorded';
    const result = await injectEvent(observed.execution_id, 'camera_result', cameraEventProperties(step, feedback));
    if (result === 'failed') logError('voice.event_failed', { event: 'camera_result' });
    return result === 'accepted' ? 'announced' : 'recorded';
  } catch (error) { logError('voice.observe_failed', {}, error); return 'failed'; }
}
