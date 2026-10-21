import 'server-only';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { skillIds, type SkillId } from './config';
import { modules } from './modules';
import { COACH_COOKIE, validCoachSession } from './coaching-security';
import { lessonDocumentSchema } from './platform-contract';
import { PlatformError, checked, platformDb, platformRateAllowed, platformUser, reviewerAllowed, type DB } from './platform-server';
import { FEATURE_LENGTH, FEATURE_VERSION, hasHands } from './vision/features';
import { evaluate, splitByClip, train, type Clip, type Evaluation, type VisionModel } from './vision/model';
import { MAX_CLIPS_PER_TARGET, MIN_CLIPS_PER_LABEL, builtinSteps, lessonSteps, qualityGate, shadowAgrees, targetLabels, type ClipSummary, type TargetSteps, type VisionAction, type VisionModelSummary, type VisionTarget } from './vision-contract';
import { clientIp } from './client-ip';

type Row = Record<string,any>; // Database JSON is validated where it is used.
type User = {id:string;email?:string|null;email_confirmed_at?:string|null};
export const VISION_CONSENT_VERSION = '2026-10-20';

// Vision lab staff: platform reviewers, plus verified emails in VISION_LAB_EMAILS
// (the owner account when unset). Staff can build models for built-in skills
// and activate any model.
const DEFAULT_LAB_EMAILS = 'thomastheconguyen@gmail.com';
export function visionStaff(user:User) {
 if(reviewerAllowed(user.id))return true;
 const allowed=(process.env.VISION_LAB_EMAILS ?? DEFAULT_LAB_EMAILS).split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 return Boolean(user.email && user.email_confirmed_at && allowed.includes(user.email.toLowerCase()));
}

/** What a target is and whether this user may contribute clips to it. */
async function resolveTarget(client:DB,user:User,target:string):Promise<{title:string;steps:TargetSteps;canContribute:boolean;staff:boolean}> {
 const staff=visionStaff(user);
 if(target.startsWith('builtin:')) {
  const skill=target.slice(8) as SkillId;
  if(!skillIds.includes(skill))throw new PlatformError(404,'not_found','Unknown lesson.');
  return {title:`${modules[skill].steps.length}-step built-in lesson: ${skill}`,steps:builtinSteps(skill),canContribute:staff,staff};
 }
 const lesson=checked(await client.from('platform_lessons').select('id,teacher_id,document,training_opt_in,published_version_id').eq('id',target.slice(7)).maybeSingle());
 if(!lesson)throw new PlatformError(404,'not_found','Unknown lesson.');
 // Teachers contribute only to their own lessons, and only after granting the separate training permission.
 const owner=lesson.teacher_id===user.id && lesson.training_opt_in===true;
 let document=lesson.document;
 if(lesson.published_version_id)document=checked(await client.from('platform_lesson_versions').select('document').eq('id',lesson.published_version_id).single())?.document??document;
 const parsed=lessonDocumentSchema.parse(document);
 return {title:parsed.title,steps:lessonSteps(parsed),canContribute:staff||owner,staff};
}
async function contributor(client:DB,user:User,target:string) {
 const resolved=await resolveTarget(client,user,target);
 if(!resolved.canContribute)throw new PlatformError(403,'forbidden','You cannot contribute training data to this lesson.');
 return resolved;
}
function modelSummary(row:Row,shadow:Row[]):VisionModelSummary {
 const checks=shadow.filter(item=>item.model_id===row.id&&item.agrees!==null);
 return {id:row.id,target:row.target,version:row.version,status:row.status,labels:row.labels,metrics:row.metrics,gate:row.gate,datasetClips:row.dataset_clips,trainedAt:row.trained_at,activatedAt:row.activated_at,shadow:{checks:checks.length,agreements:checks.filter(item=>item.agrees).length}};
}

export async function visionRead(request:NextRequest) {
 const params=request.nextUrl.searchParams;const view=params.get('view')||'targets';const client=platformDb();
 if(view==='active') {
  // Public: learners' devices download the active model. Weights reveal no contributor data.
  const target=params.get('target')||'';
  if(!/^(builtin:[a-z]+|lesson:[a-f0-9-]{36})$/.test(target))throw new PlatformError(400,'validation','Choose a valid lesson.');
  const row=checked(await client.from('vision_models').select('id,target,version,model,feature_version').eq('target',target).eq('status','active').maybeSingle());
  return {model:row&&row.feature_version===FEATURE_VERSION?{id:row.id,target:row.target,version:row.version,model:row.model as VisionModel}:null};
 }
 const user=await platformUser(request,client);
 if(view==='targets') {
  const staff=visionStaff(user);
  const lessons=checked(await (staff?client.from('platform_lessons').select('id').eq('training_opt_in',true).limit(200):client.from('platform_lessons').select('id').eq('teacher_id',user.id).eq('training_opt_in',true).limit(200)))||[];
  const ids=[...(staff?skillIds.map(skill=>`builtin:${skill}`):[]),...lessons.map(item=>`lesson:${item.id}`)];
  if(!ids.length)return {staff,targets:[]};
  const [clips,models]=await Promise.all([
   client.from('vision_clips').select('target,label').in('target',ids).limit(20000),
   client.from('vision_models').select('id,target,version,status,labels,metrics,gate,dataset_clips,trained_at,activated_at').in('target',ids).order('version',{ascending:false}).limit(500),
  ]);
  const modelRows=checked(models)||[];
  const shadow=modelRows.length?checked(await client.from('vision_shadow_checks').select('model_id,agrees').in('model_id',modelRows.map(item=>item.id)).limit(50000))||[]:[];
  const targets:VisionTarget[]=[];
  for(const target of ids) {
   const resolved=await resolveTarget(client,user,target).catch(()=>null);
   if(!resolved)continue;
   const clipCounts:Record<string,number>={};
   for(const clip of checked(clips)||[])if(clip.target===target)clipCounts[clip.label]=(clipCounts[clip.label]||0)+1;
   targets.push({target,title:resolved.title,steps:resolved.steps,labels:targetLabels(resolved.steps),clipCounts,canContribute:resolved.canContribute,models:modelRows.filter(item=>item.target===target).map(item=>modelSummary(item,shadow))});
  }
  return {staff,targets};
 }
 const target=params.get('target')||'';
 await contributor(client,user,target);
 if(view==='clips') {
  const rows=checked(await client.from('vision_clips').select('id,label,source,hand_rate,created_at,contributor_id,frames').eq('target',target).order('created_at',{ascending:false}).limit(MAX_CLIPS_PER_TARGET))||[];
  return {clips:rows.map((row):ClipSummary=>({id:row.id,label:row.label,frames:Array.isArray(row.frames)?row.frames.length:0,handRate:row.hand_rate,source:row.source,createdAt:row.created_at,mine:row.contributor_id===user.id}))};
 }
 if(view==='export') {
  if(!visionStaff(user))throw new PlatformError(403,'forbidden','Only vision lab staff can export datasets.');
  const rows=checked(await client.from('vision_clips').select('id,label,source,feature_version,frames,created_at').eq('target',target).limit(MAX_CLIPS_PER_TARGET))||[];
  return {target,featureVersion:FEATURE_VERSION,featureLength:FEATURE_LENGTH,consentVersion:VISION_CONSENT_VERSION,clips:rows};
 }
 throw new PlatformError(400,'validation','Unknown vision view.');
}

/** Trains on held-out-split clips for honest metrics, then retrains on everything for deployment. */
export function trainTarget(clips:Clip[],labelOrder:string[]) {
 const counts=new Map<string,number>();
 for(const clip of clips)counts.set(clip.label,(counts.get(clip.label)||0)+1);
 const labels=labelOrder.filter(label=>(counts.get(label)||0)>=MIN_CLIPS_PER_LABEL);
 const missing=labelOrder.filter(label=>counts.get(label)&&(counts.get(label)||0)<MIN_CLIPS_PER_LABEL);
 if(labels.length<2)throw new PlatformError(400,'not_enough_data',`Record at least ${MIN_CLIPS_PER_LABEL} clips for at least two labels (for example “In between” and one step).`);
 const usable=clips.filter(clip=>labels.includes(clip.label));
 const {training,validation}=splitByClip(usable);
 const metrics:Evaluation=evaluate(train(training,labels),validation,training.length);
 return {labels,metrics,gate:qualityGate(metrics),model:train(usable,labels),skipped:missing,clips:usable.length};
}

export async function visionWrite(request:NextRequest,action:VisionAction) {
 const client=platformDb();
 if(action.action==='shadow') {
  if(!validCoachSession(request.cookies.get(COACH_COOKIE)?.value))throw new PlatformError(401,'session','Start camera coaching first.');
  const ip=clientIp(request);
  if(!platformRateAllowed(createHash('sha256').update(ip).digest('hex'),'vision.shadow'))throw new PlatformError(429,'rate','Too many checks.');
  const model=checked(await client.from('vision_models').select('id,status').eq('id',action.modelId).maybeSingle());
  if(!model||model.status!=='active')throw new PlatformError(404,'not_found','This model is not active.');
  const {error}=await client.from('vision_shadow_checks').insert({model_id:action.modelId,step:action.step,predicted:action.predicted,confidence:action.confidence,coach_status:action.coachStatus,agrees:shadowAgrees(action.predicted,action.step,action.coachStatus)});
  if(error)throw new PlatformError(503,'storage','The comparison could not be saved.');
  return {ok:true};
 }
 const user=await platformUser(request,client);
 if(!platformRateAllowed(user.id,`vision.${action.action}`))throw new PlatformError(429,'rate','Too many attempts. Please try again in ten minutes.');
 const resolved=await contributor(client,user,action.target);
 if(action.action==='clip.add') {
  const labels=targetLabels(resolved.steps).map(item=>item.id);
  if(!labels.includes(action.label))throw new PlatformError(400,'validation','This label does not exist for this lesson.');
  const handRate=action.frames.filter(hasHands).length/action.frames.length;
  if(action.label!=='other'&&handRate<0.5)throw new PlatformError(400,'no_hands',`Hands were visible in only ${Math.round(handRate*100)}% of this clip. Keep your hands and the work in view, then record again.`);
  const existing=await client.from('vision_clips').select('id',{count:'exact',head:true}).eq('target',action.target);
  if(existing.error)throw new PlatformError(503,'storage','The clip could not be saved.');
  if((existing.count||0)>=MAX_CLIPS_PER_TARGET)throw new PlatformError(409,'full',`This lesson already has ${MAX_CLIPS_PER_TARGET} clips. Delete weaker clips before adding more.`);
  const row=checked(await client.from('vision_clips').insert({target:action.target,label:action.label,contributor_id:user.id,source:action.source,feature_version:FEATURE_VERSION,frames:action.frames,hand_rate:handRate,consent_version:VISION_CONSENT_VERSION}).select('id').single());
  return {ok:true,clipId:row?.id,handRate};
 }
 if(action.action==='clip.delete') {
  const clip=checked(await client.from('vision_clips').select('id,contributor_id,target').eq('id',action.clipId).maybeSingle());
  if(!clip||clip.target!==action.target)throw new PlatformError(404,'not_found','Clip not found.');
  if(clip.contributor_id!==user.id&&!resolved.staff)throw new PlatformError(403,'forbidden','You can delete only your own clips.');
  checked(await client.from('vision_clips').delete().eq('id',action.clipId));
  return {ok:true};
 }
 if(action.action==='model.train') {
  const rows=checked(await client.from('vision_clips').select('id,label,frames,feature_version').eq('target',action.target).limit(MAX_CLIPS_PER_TARGET))||[];
  const clips:Clip[]=rows.filter(row=>row.feature_version===FEATURE_VERSION&&Array.isArray(row.frames)).map(row=>({id:row.id,label:row.label,frames:row.frames}));
  const result=trainTarget(clips,targetLabels(resolved.steps).map(item=>item.id));
  const latest=checked(await client.from('vision_models').select('version').eq('target',action.target).order('version',{ascending:false}).limit(1).maybeSingle());
  const row=checked(await client.from('vision_models').insert({target:action.target,version:(latest?.version||0)+1,labels:result.labels,model:result.model,metrics:result.metrics,gate:result.gate,dataset_clips:result.clips,feature_version:FEATURE_VERSION,trained_by:user.id}).select('id,target,version,status,labels,metrics,gate,dataset_clips,trained_at,activated_at').single());
  if(!row)throw new PlatformError(503,'storage','The model could not be saved.');
  return {model:modelSummary(row,[]),skipped:result.skipped};
 }
 if(!resolved.staff)throw new PlatformError(403,'forbidden','A vision lab reviewer activates models.');
 const model=checked(await client.from('vision_models').select('id,target').eq('id',action.modelId).maybeSingle());
 if(!model||model.target!==action.target)throw new PlatformError(404,'not_found','Model not found.');
 if(action.action==='model.activate') {
  const {error}=await client.rpc('vision_activate',{actor_id:user.id,model_id:action.modelId});
  if(error)throw new PlatformError(409,'conflict',String(error.message).includes('conflict')?'Only a candidate that passed its quality gate can be activated.':'The model could not be activated.');
  return {ok:true};
 }
 checked(await client.from('vision_models').update({status:'retired'}).eq('id',action.modelId));
 return {ok:true};
}
