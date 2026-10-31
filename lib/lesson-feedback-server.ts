import 'server-only';
import type { z } from 'zod';
import { authenticatedUser } from './auth/server';
import { PlatformError, platformDb, publishedLesson } from './platform-server';
import { practiceVersion } from './training-server';
import { LESSON_CONTENT_VERSION } from './learning-progress';
import { skillIds, type SkillId } from './config';
import { logError } from './log';
import { feedbackInput, feedbackTarget, type FeedbackResult } from './lesson-feedback';

function feedbackStorage<T>(result: {data: T; error: unknown}, operation: string): T {
  if (result.error) {
    const raw = typeof result.error === 'object' && 'code' in result.error ? result.error.code : undefined;
    const code = typeof raw === 'string' && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(raw) ? raw : 'unknown';
    logError('feedback.storage_failed', {operation,code});
    throw new PlatformError(503,'storage','Lesson feedback is temporarily unavailable. Please try again.');
  }
  return result.data;
}

async function target(input: z.infer<typeof feedbackTarget>, allowOlder = false) {
  const user = await authenticatedUser();
  if (!user || user.is_anonymous || !user.email_confirmed_at) throw new PlatformError(401,'sign_in','Sign in with a confirmed account to leave feedback.');
  const client = platformDb();
  const [kind, id] = input.lessonKey.split(':');
  let version: number;
  if (kind === 'builtin') {
    if (!skillIds.includes(id as SkillId)) throw new PlatformError(404,'not_found','Lesson not found.');
    version = LESSON_CONTENT_VERSION;
  } else if (kind === 'published') version = (await publishedLesson(client, id)).version;
  else version = (await practiceVersion(client, user.id, id)).version.version;
  if (version !== input.version && !(allowOlder && input.version < version)) throw new PlatformError(409,'version_changed','This lesson has changed. Reload it before leaving feedback.');
  return { user, client };
}
export async function readLessonFeedback(input: z.infer<typeof feedbackTarget>): Promise<FeedbackResult> {
  const { user, client } = await target(input);
  const [own, summary] = await Promise.all([
    client.from('lesson_feedback').select('version,rating,comment,created_at,updated_at').eq('user_id', user.id).eq('lesson_key', input.lessonKey).order('version', { ascending: false }).limit(30),
    client.rpc('lesson_feedback_summary', { p_key: input.lessonKey, p_version: input.version }),
  ]);
  const rows = feedbackStorage(own,'read') || [];
  return { own: rows.map(row => ({ version: row.version, rating: row.rating, comment: row.comment, createdAt: row.created_at, updatedAt: row.updated_at })), summary: feedbackStorage(summary,'summary') };
}
export async function writeLessonFeedback(input: z.infer<typeof feedbackInput>) {
  const { user, client } = await target(input, input.action === 'delete');
  const rate = await client.rpc('rate_hit', { p_key: `feedback:${user.id}`, p_max: 20, p_window_seconds: 900 });
  feedbackStorage(rate,'rate_limit');
  if (rate.data !== true) throw new PlatformError(429,'rate','Too many updates. Please try again later.');
  if (input.action === 'delete') feedbackStorage(await client.from('lesson_feedback').delete().eq('user_id', user.id).eq('lesson_key', input.lessonKey).eq('version', input.version),'delete');
  else feedbackStorage(await client.rpc('lesson_feedback_save', { p_user: user.id, p_key: input.lessonKey, p_version: input.version, p_rating: input.rating, p_comment: input.comment }),'save');
  return { ok: true };
}
