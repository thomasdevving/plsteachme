import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, handleBody } from '@/lib/api-route';
import { PlatformError } from '@/lib/platform-server';
import { feedbackInput, feedbackTarget } from '@/lib/lesson-feedback';
import { readLessonFeedback, writeLessonFeedback } from '@/lib/lesson-feedback-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest) {
  return handle(async () => {
    const parsed = feedbackTarget.extend({ version: z.coerce.number().int().min(1).max(999999) }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) throw new PlatformError(400,'validation','Choose a valid lesson and version.');
    return readLessonFeedback(parsed.data);
  });
}
export function POST(request: NextRequest) { return handleBody(request, feedbackInput, 12000, writeLessonFeedback); }
