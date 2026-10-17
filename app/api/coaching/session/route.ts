import { NextRequest } from 'next/server';
import { CHECK_INTERVAL_MS, coachConsentSchema } from '@/lib/coaching-contract';
import { requireTrial } from '@/lib/auth/trial';
import { COACH_COOKIE, SESSION_SECONDS, coachJson, coachingConfigured, sameOrigin, coachingRateAllowed, limitedJson, createCoachSession } from '@/lib/coaching-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  return coachJson({available:coachingConfigured(),provider:'OpenAI',intervalMs:CHECK_INTERVAL_MS});
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return coachJson({error:'origin'},403);
  if (!coachingConfigured()) return coachJson({error:'unavailable'},503);
  if (!coachingRateAllowed(request,'session')) return coachJson({error:'rate'},429,{'Retry-After':'600'});
  const body = await limitedJson(request,1024);
  if ('error' in body) return coachJson({error:body.error},body.error==='size'?413:400);
  if (!coachConsentSchema.safeParse(body.data).success) return coachJson({error:'consent'},400);
  const denied=await requireTrial(request);if(denied)return denied;
  const response = coachJson({accepted:true});
  response.cookies.set(COACH_COOKIE,createCoachSession(),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api/coaching',maxAge:SESSION_SECONDS});
  return response;
}
export function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return coachJson({error:'origin'},403);
  const response = coachJson({stopped:true});
  response.cookies.set(COACH_COOKIE,'',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api/coaching',maxAge:0});
  return response;
}
