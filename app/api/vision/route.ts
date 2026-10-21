import { NextRequest } from 'next/server';
import { coachJson, limitedJson, sameOrigin } from '@/lib/coaching-security';
import { visionActionSchema } from '@/lib/vision-contract';
import { PlatformError, platformConfigured } from '@/lib/platform-server';
import { visionRead, visionWrite } from '@/lib/vision-server';
import { logError } from '@/lib/log';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function failure(error:unknown) {
 if(error instanceof PlatformError)return coachJson({error:error.code,message:error.message},error.status,error.status===429?{'Retry-After':'600'}:{});
 logError('api.unhandled',{route:'vision'},error);
 return coachJson({error:'unavailable',message:'This action could not be completed. Please try again.'},503);
}
export async function GET(request:NextRequest) {
 if(!platformConfigured())return coachJson({error:'unavailable',message:'The vision lab is not configured yet.'},503);
 try{return coachJson(await visionRead(request));}catch(error){return failure(error);}
}
export async function POST(request:NextRequest) {
 if(!sameOrigin(request))return coachJson({error:'origin',message:'Open this page on plsteach.me to continue.'},403);
 if(!platformConfigured())return coachJson({error:'unavailable',message:'The vision lab is not configured yet.'},503);
 // The largest request is one 300-frame landmark clip.
 const body=await limitedJson(request,600_000);
 if('error' in body)return coachJson({error:body.error,message:'The request is invalid or too large.'},body.error==='size'?413:400);
 const parsed=visionActionSchema.safeParse(body.data);
 if(!parsed.success)return coachJson({error:'validation',message:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join(' ').slice(0,600)},400);
 try{return coachJson(await visionWrite(request,parsed.data));}catch(error){return failure(error);}
}
