import { NextRequest } from 'next/server';
import { recordCoachVerdict } from '@/lib/account-server';
import { coachRequestSchema, MAX_COACH_BODY_BYTES } from '@/lib/coaching-contract';
import { COACH_COOKIE, coachJson, coachingConfigured, sameOrigin, coachingRateAllowed, limitedJson, validCoachSession } from '@/lib/coaching-security';
import { assessCoachStep, decodeCoachFrame } from '@/lib/coaching-ai';
import { requireTrial } from '@/lib/auth/trial';
import { builtinTrialId } from '@/lib/auth/trial-reference';
import { logAiFailure } from '@/lib/log';
import { recordVoiceObservation } from '@/lib/voice/observe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return coachJson({error:'origin'},403);
  if (!coachingConfigured()) return coachJson({error:'unavailable'},503);
  if (!validCoachSession(request.cookies.get(COACH_COOKIE)?.value)) return coachJson({error:'session'},401);
  if (!coachingRateAllowed(request,'check')) return coachJson({error:'rate'},429,{'Retry-After':'600'});
  const body = await limitedJson(request,MAX_COACH_BODY_BYTES);
  if ('error' in body) return coachJson({error:body.error},body.error==='size'?413:400);
  const parsed = coachRequestSchema.safeParse(body.data);
  if (!parsed.success) return coachJson({error:'validation'},400);
  const denied=await requireTrial(request,builtinTrialId(parsed.data.skill));if(denied)return denied;
  let frames: Buffer[];
  try { frames = await Promise.all(parsed.data.frames.map(decodeCoachFrame)); }
  catch { return coachJson({error:'image'},400); }
  const timeout = AbortSignal.timeout(22000);
  try {
    const feedback = await assessCoachStep(parsed.data.skill,parsed.data.step,frames,AbortSignal.any([request.signal,timeout]));
    await recordCoachVerdict(request,`builtin:${parsed.data.skill}`,parsed.data.step,feedback.status);
    // Only this server-produced result can reach the voice coach.
    await recordVoiceObservation(request,parsed.data.skill,parsed.data.step,feedback);
    return coachJson({skill:parsed.data.skill,step:parsed.data.step,feedback});
  } catch(error) {
    // Only the failure category is logged: never provider messages, prompts, images or credentials.
    logAiFailure('coaching.check',error,timeout.aborted);
    return coachJson({error:timeout.aborted?'timeout':'provider'},timeout.aborted?504:502);
  }
}
