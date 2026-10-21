import 'server-only';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authClient, authenticatedUser } from './auth/server';
import { PlatformError, checked, platformDb, platformRateAllowed } from './platform-server';
import { VIDEO_BUCKET } from './platform-contract';
import { TRAINING_BUCKET } from './training-contract';
import { visionStaff } from './vision-server';
import { clientIp } from './client-ip';

export const lessonKeySchema = z.string().regex(/^(builtin:[a-z]+|published:[a-f0-9-]{36}:v[0-9]{1,6})$/);
export const progressSaveSchema = z.object({lessonKey:lessonKeySchema,data:z.unknown(),updatedAt:z.number().int().min(0).max(8.64e15)}).strict();
export const learningEventSchema = z.object({
 sessionId:z.uuid(),
 events:z.array(z.object({lessonKey:lessonKeySchema,kind:z.enum(['lesson_start','step','lesson_complete']),step:z.number().int().min(0).max(19).optional(),result:z.enum(['','camera_confirmed','self_checked','unresolved']).default('')}).strict()).min(1).max(20),
}).strict();
export const accountActionSchema = z.object({action:z.literal('delete'),confirm:z.literal('delete my account')}).strict();

async function signedIn() {
 const user=await authenticatedUser();
 if(!user || user.is_anonymous)throw new PlatformError(401,'sign_in','Sign in to continue.');
 return user;
}

/** Every lesson's saved progress for this account. */
export async function listProgress() {
 const user=await signedIn();
 const rows=checked(await platformDb().from('learner_progress').select('lesson_key,data,client_updated_at').eq('user_id',user.id).limit(500))||[];
 return {progress:rows.map(row=>({lessonKey:row.lesson_key,data:row.data,updatedAt:Number(row.client_updated_at)}))};
}
/** Saves one lesson's progress; an older copy never overwrites a newer one. */
export async function saveProgress(input:z.infer<typeof progressSaveSchema>) {
 const user=await signedIn();
 if(!platformRateAllowed(user.id,'progress.save'))throw new PlatformError(429,'rate','Too many saves. Please try again shortly.');
 if(JSON.stringify(input.data ?? null).length>16000)throw new PlatformError(413,'size','This progress record is too large.');
 const {data,error}=await platformDb().rpc('progress_save',{p_user:user.id,p_key:input.lessonKey,p_data:input.data,p_updated:input.updatedAt});
 if(error)throw new PlatformError(503,'storage','Progress could not be saved.');
 return {progress:data};
}

/** Anonymous learning events: a random per-browser ID, lesson, step and result only. */
export async function recordLearningEvents(request:NextRequest,input:z.infer<typeof learningEventSchema>) {
 const ip=clientIp(request);
 if(!platformRateAllowed(createHash('sha256').update(ip).digest('hex'),'learning.events'))throw new PlatformError(429,'rate','Too many events.');
 const {error}=await platformDb().from('learning_events').insert(input.events.map(event=>({session_id:input.sessionId,lesson_key:event.lessonKey,kind:event.kind,step:event.step ?? null,result:event.result})));
 if(error)throw new PlatformError(503,'storage','Events could not be saved.');
 return {ok:true};
}
/** Records the cloud coach's verdict for a step; called by the coaching routes. Never blocks coaching. */
export async function recordCoachVerdict(request:Request,lessonKey:string,step:number,status:string) {
 try {
  const session=request.headers.get('x-learning-session');
  await platformDb().from('learning_events').insert({session_id:session&&/^[a-f0-9-]{36}$/i.test(session)?session:null,lesson_key:lessonKey,kind:'coach',step,result:status});
 } catch { /* Measurement is best-effort. */ }
}
export async function learningInsights(days:number) {
 const user=await signedIn();
 if(!visionStaff(user))throw new PlatformError(403,'forbidden','The insights are only available to plsteach.me staff.');
 const since=new Date(Date.now()-days*86_400_000).toISOString();
 const {data,error}=await platformDb().rpc('learning_insights',{since});
 if(error)throw new PlatformError(503,'storage','The insights could not load.');
 return {insights:data};
}

async function removeFiles(bucket:string,paths:string[]) {
 const client=platformDb();
 for(let i=0;i<paths.length;i+=100) {
  const {error}=await client.storage.from(bucket).remove(paths.slice(i,i+100));
  if(error)throw new PlatformError(503,'storage','Some stored files could not be removed. Please try again.');
 }
}
/** Deletes the signed-in account: database records, stored files, then the sign-in account itself. */
export async function deleteAccount() {
 const user=await signedIn();
 const client=platformDb();
 const {data,error}=await client.rpc('account_delete',{p_user:user.id,p_email:user.email ?? ''});
 if(error) {
  if(String(error.message).includes('sole_admin'))throw new PlatformError(409,'sole_admin','You are the only admin of an organization with other members. Make someone else an admin, or remove the other members, before deleting your account.');
  throw new PlatformError(503,'storage','Your account could not be deleted. Please try again.');
 }
 const result=data as {demoPaths:string[];trainingPaths:string[]};
 await removeFiles(VIDEO_BUCKET,result.demoPaths||[]);
 await removeFiles(TRAINING_BUCKET,result.trainingPaths||[]);
 const auth=await authClient();
 await auth?.auth.signOut().catch(()=>null);
 const removed=await client.auth.admin.deleteUser(user.id);
 if(removed.error)throw new PlatformError(503,'storage','Your data was deleted, but the sign-in account could not be removed. Please try again.');
 return {deleted:true};
}

/** Scheduled retention cleanup. Requires the MAINTENANCE_SECRET bearer token. */
export async function runRetention(request:Request) {
 const secret=process.env.MAINTENANCE_SECRET?.trim();
 if(!secret || secret.length<24)throw new PlatformError(503,'unavailable','Maintenance is not configured.');
 const supplied=request.headers.get('authorization')||'';
 const expected=`Bearer ${secret}`;
 if(supplied.length!==expected.length || !createHash('sha256').update(supplied).digest().equals(createHash('sha256').update(expected).digest()))throw new PlatformError(401,'unauthorized','Not authorized.');
 const {data,error}=await platformDb().rpc('retention_cleanup');
 if(error)throw new PlatformError(503,'storage','Retention cleanup failed.');
 // Expired rate-limit windows and old AI usage counters.
 const ephemeral=await platformDb().rpc('ephemeral_cleanup');
 if(ephemeral.error)throw new PlatformError(503,'storage','Retention cleanup failed.');
 // Expired voice sessions, old voice commands and webhook delivery keys.
 const voice=await platformDb().rpc('voice_cleanup');
 if(voice.error)throw new PlatformError(503,'storage','Retention cleanup failed.');
 const result=data as {demoPaths:string[];trainingPaths:string[];reports:number;events:number;shadowChecks:number};
 await removeFiles(VIDEO_BUCKET,result.demoPaths||[]);
 await removeFiles(TRAINING_BUCKET,result.trainingPaths||[]);
 return {ok:true,removed:{teacherVideos:result.demoPaths?.length||0,organizationFiles:result.trainingPaths?.length||0,reports:result.reports,events:result.events,shadowChecks:result.shadowChecks}};
}
