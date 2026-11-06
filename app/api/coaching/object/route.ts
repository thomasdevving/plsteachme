import { NextRequest } from 'next/server';
import { z } from 'zod';
import { skillIds } from '@/lib/config';
import { COACH_COOKIE, coachJson, coachingConfigured, sameOrigin, coachingRateAllowed, limitedJson, validCoachSession } from '@/lib/coaching-security';
import { MAX_COACH_BODY_BYTES } from '@/lib/coaching-contract';
import { decodeCoachFrame } from '@/lib/coaching-ai';
import { requireTrial } from '@/lib/auth/trial';
import { builtinTrialId } from '@/lib/auth/trial-reference';
import { builtinCameraGuidance, guidedObject } from '@/lib/vision/camera-guidance';
import { objectScanFields } from '@/lib/vision/object-scan-contract';
import { recognizeCameraObject } from '@/lib/vision/object-recognition-ai';
import { logAiFailure } from '@/lib/log';
const schema=z.object({skill:z.enum(skillIds),...objectScanFields}).strict();
export const runtime='nodejs';
export async function POST(request:NextRequest) {
 if(!sameOrigin(request))return coachJson({error:'origin'},403);
 if(!coachingConfigured())return coachJson({error:'unavailable'},503);
 if(!validCoachSession(request.cookies.get(COACH_COOKIE)?.value))return coachJson({error:'session'},401);
 if(!coachingRateAllowed(request,'check'))return coachJson({error:'rate'},429);
 const body=await limitedJson(request,MAX_COACH_BODY_BYTES);if('error' in body)return coachJson({error:body.error},body.error==='size'?413:400);
 const parsed=schema.safeParse(body.data);if(!parsed.success)return coachJson({error:'validation'},400);
 const kind=guidedObject(builtinCameraGuidance[parsed.data.skill]);if(!kind)return coachJson({error:'unsupported'},400);
 const denied=await requireTrial(request,builtinTrialId(parsed.data.skill));if(denied)return denied;
 let frames:Buffer[];try{frames=await Promise.all(parsed.data.frames.map(decodeCoachFrame));}catch{return coachJson({error:'image'},400);}
 const timeout=AbortSignal.timeout(22000);
 try{return coachJson({object:await recognizeCameraObject(kind,frames,parsed.data.guide,AbortSignal.any([request.signal,timeout]))});}
 catch(error){logAiFailure('coaching.object',error,timeout.aborted);return coachJson({error:'provider'},timeout.aborted?504:502);}
}
