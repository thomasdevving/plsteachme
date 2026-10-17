import { NextRequest } from 'next/server';
import { db, mockMode } from '@/lib/storage';
import { reportSchema } from '@/lib/lesson-help';
import { LessonHelpError, resolveLessonHelp } from '@/lib/lesson-help-context';
import { COACH_COOKIE, coachJson, sameOrigin, coachingRateAllowed, limitedJson, validCoachSession } from '@/lib/coaching-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return coachJson({error:'origin'},403);
  if (!validCoachSession(request.cookies.get(COACH_COOKIE)?.value)) return coachJson({error:'session'},401);
  if (!coachingRateAllowed(request,'report')) return coachJson({error:'rate'},429,{'Retry-After':'600'});
  const body = await limitedJson(request,6144);
  if ('error' in body) return coachJson({error:body.error},body.error==='size'?413:400);
  const parsed = reportSchema.safeParse(body.data);
  if (!parsed.success) return coachJson({error:'validation'},400);
  if (mockMode) return coachJson({error:'unavailable'},503);
  const {step,feedback,reason} = parsed.data;
  try {
    const context=await resolveLessonHelp(parsed.data);
    const {error} = await db().from('coaching_reports').insert({...context.reportTarget,step,...feedback,reason});
    if (error) throw error;
    return coachJson({accepted:true},201);
  } catch(error) {
    if(error instanceof LessonHelpError)return coachJson({error:error.code},error.status);
    return coachJson({error:'storage'},503);
  }
}
