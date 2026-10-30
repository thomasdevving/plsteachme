import { z } from 'zod';
export const feedbackLessonKey = z.string().regex(/^(builtin:[a-z]+|(?:published|training):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/);
export const feedbackTarget = z.object({ lessonKey: feedbackLessonKey, version: z.number().int().min(1).max(999999) });
export const feedbackInput = z.discriminatedUnion('action', [
  feedbackTarget.extend({ action: z.literal('save'), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000) }).strict(),
  feedbackTarget.extend({ action: z.literal('delete') }).strict(),
]);
export type LessonFeedback = { version: number; rating: number; comment: string; createdAt: string; updatedAt: string };
export type FeedbackResult = { own: LessonFeedback[]; summary: { count: number; average: number | null } };
