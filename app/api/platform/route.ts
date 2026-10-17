import { NextRequest } from 'next/server';
import { coachJson, limitedJson, sameOrigin } from '@/lib/coaching-security';
import { platformActionSchema } from '@/lib/platform-contract';
import { PlatformError, platformConfigured, platformRead, platformWrite } from '@/lib/platform-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function failure(error:unknown) {
 if(error instanceof PlatformError)return coachJson({error:error.code,message:error.message},error.status,error.status===429?{'Retry-After':'600'}:{});
 return coachJson({error:'unavailable',message:'This action could not be completed. Please try again.'},503);
}
export async function GET(request:NextRequest) {try{return coachJson(await platformRead(request));}catch(error){return failure(error);}}
export async function POST(request:NextRequest) {
 if(!sameOrigin(request))return coachJson({error:'origin',message:'Open this page on plsteach.me to continue.'},403);
 if(!platformConfigured())return coachJson({error:'unavailable',message:'The community platform is not configured yet.'},503);
 const body=await limitedJson(request,1120000);
 if('error' in body)return coachJson({error:body.error,message:'The request is invalid or too large.'},body.error==='size'?413:400);
 const parsed=platformActionSchema.safeParse(body.data);
 if(!parsed.success)return coachJson({error:'validation',message:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join(' ').slice(0,600)},400);
 try{return coachJson(await platformWrite(request,parsed.data));}catch(error){return failure(error);}
}
