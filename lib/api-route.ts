import 'server-only';
import { NextRequest } from 'next/server';
import type { z } from 'zod';
import { coachJson, limitedJson, sameOrigin } from './coaching-security';
import { PlatformError, platformConfigured } from './platform-server';

/** Shared JSON route plumbing: configuration, same-origin, bounded body, validation and errors. */
export function failure(error:unknown) {
 if(error instanceof PlatformError)return coachJson({error:error.code,message:error.message},error.status,error.status===429?{'Retry-After':'60'}:{});
 return coachJson({error:'unavailable',message:'This action could not be completed. Please try again.'},503);
}
export async function handle(task:()=>Promise<unknown>) {
 if(!platformConfigured())return coachJson({error:'unavailable',message:'Accounts are not configured yet.'},503);
 try{return coachJson(await task());}catch(error){return failure(error);}
}
export async function handleBody<T extends z.ZodType>(request:NextRequest,schema:T,limit:number,task:(input:z.infer<T>)=>Promise<unknown>) {
 if(!sameOrigin(request))return coachJson({error:'origin',message:'Open this page on plsteach.me to continue.'},403);
 if(!platformConfigured())return coachJson({error:'unavailable',message:'Accounts are not configured yet.'},503);
 const body=await limitedJson(request,limit);
 if('error' in body)return coachJson({error:body.error,message:'The request is invalid or too large.'},body.error==='size'?413:400);
 const parsed=schema.safeParse(body.data);
 if(!parsed.success)return coachJson({error:'validation',message:'The request is invalid.'},400);
 try{return coachJson(await task(parsed.data));}catch(error){return failure(error);}
}
