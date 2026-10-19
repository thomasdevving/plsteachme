import { z } from 'zod';
import { lessonDocumentSchema, lessonStepSchema, platformCategories, type LessonDocument } from './platform-contract';

// Organization plans. Seats count learners (invited or active); admins and
// instructors are included. Billing is not active during testing.
export const trainingPlans = [
 {id:'up-to-25',learners:25,monthly:100},
 {id:'up-to-75',learners:75,monthly:200},
 {id:'up-to-150',learners:150,monthly:350},
 {id:'up-to-300',learners:300,monthly:500},
] as const;
export type TrainingPlanId = typeof trainingPlans[number]['id'];
export const trainingPlanIds = trainingPlans.map(plan=>plan.id) as [TrainingPlanId,...TrainingPlanId[]];
export function trainingPlan(id:string) { return trainingPlans.find(plan=>plan.id===id) ?? null; }
/** The smallest plan that fits a learner count, or null above the largest plan. */
export function planForLearners(count:number) { return trainingPlans.find(plan=>count<=plan.learners) ?? null; }

export const organizationKinds = ['school','training_provider','business'] as const;
export const organizationKindLabels: Record<typeof organizationKinds[number],string> = {school:'School',training_provider:'Training provider',business:'Business'};
export const trainingRoles = ['admin','instructor','learner'] as const;
export type TrainingRole = typeof trainingRoles[number];
export const trainingRoleLabels: Record<TrainingRole,string> = {admin:'Admin',instructor:'Instructor',learner:'Learner'};
export const TRAINING_BUCKET = 'organization-training';
export const MAX_TRAINING_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_MANUAL_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_TEXT = 60000;
export const MAX_MOMENTS = 12;
export const INVITE_DAYS = 30;

const uuidPart = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const framePathPattern = new RegExp(`^${uuidPart}/${uuidPart}/frames/${uuidPart}\\.jpg$`);
const jpegData = z.string().max(270000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);

/** A still from the instructor's tracked demonstration, attached to a step. */
export const stepReferenceSchema = z.object({frame:z.string().max(220).regex(framePathPattern),startSec:z.number().min(0).max(600),endSec:z.number().min(0).max(600),hands:z.number().int().min(0).max(2)}).strict();
export type StepReference = z.infer<typeof stepReferenceSchema>;
export const trainingStepSchema = lessonStepSchema.extend({reference:stepReferenceSchema.optional()}).strict();
export const trainingDocumentSchema = lessonDocumentSchema.extend({steps:z.array(trainingStepSchema).min(1).max(20)}).strict();
export type TrainingDocument = z.infer<typeof trainingDocumentSchema>;

export const momentSchema = z.object({frame:z.string().max(220).regex(framePathPattern),at:z.number().min(0).max(600),kind:z.enum(['hold','marker']),hands:z.number().int().min(0).max(2),caption:z.string().trim().max(300)}).strict();
export type TrainingMoment = z.infer<typeof momentSchema>;

/** AI output: a lesson plus which captured moment illustrates each step. */
export const trainingDraftSchema = z.object({
 document:lessonDocumentSchema,
 stepMoments:z.array(z.number().int().min(-1).max(MAX_MOMENTS-1)).max(20),
 verify:z.array(z.string().max(300)).max(12),
});
export type TrainingDraft = z.infer<typeof trainingDraftSchema>;

export type StepResult = 'pending'|'visual'|'manual'|'unresolved';
export const stepResults = ['pending','visual','manual','unresolved'] as const;

export type TrainingOrganization = {id:string;name:string;kind:typeof organizationKinds[number];plan:TrainingPlanId;seatLimit:number;createdAt:string};
export type TrainingMembership = {memberId:string;role:TrainingRole;organization:TrainingOrganization};
export type TrainingMember = {id:string;email:string;displayName:string;role:TrainingRole;status:'invited'|'active'|'removed';joinedAt:string|null;inviteExpiresAt:string|null};
export type TrainingModule = {id:string;organizationId:string;source:'demonstration'|'manual'|'blank';status:'draft'|'published'|'archived';document:TrainingDocument;sourceText:string;moments:TrainingMoment[];demoPath:string|null;manualPath:string|null;audience:'all'|'selected';version:number;publishedVersionId:string|null;publishedAt:string|null;updatedAt:string;assignedMemberIds:string[];unpublishedChanges:boolean};
export type TrainingProgress = {moduleId:string;memberId:string;version:number;step:number;results:StepResult[];completedResults:StepResult[]|null;startedAt:string;updatedAt:string;completedAt:string|null};
export type LearnerModule = {id:string;version:number;title:string;objective:string;category:typeof platformCategories[number];steps:number;publishedAt:string|null;progress:TrainingProgress|null};
export type TrainingOrgView = {organization:TrainingOrganization;role:TrainingRole;memberId:string;seatsUsed:number;members?:TrainingMember[];modules?:TrainingModule[];progress?:TrainingProgress[];assigned:LearnerModule[]};
export type TrainingModuleView = {id:string;organizationId:string;version:number;document:TrainingDocument;hasVideo:boolean;frames:Record<string,string>;progress:TrainingProgress|null;trackProgress:boolean};

const id = z.uuid();
const memberIds = z.array(id).max(300);
export const trainingActionSchema = z.discriminatedUnion('action',[
 z.object({action:z.literal('org.create'),name:z.string().trim().min(2).max(120),kind:z.enum(organizationKinds),plan:z.enum(trainingPlanIds)}).strict(),
 z.object({action:z.literal('org.plan'),organizationId:id,plan:z.enum(trainingPlanIds)}).strict(),
 z.object({action:z.literal('member.invite'),organizationId:id,role:z.enum(trainingRoles),emails:z.array(z.email().max(254)).min(1).max(100)}).strict(),
 z.object({action:z.literal('member.accept'),token:z.string().regex(/^[A-Za-z0-9_-]{32}$/)}).strict(),
 z.object({action:z.literal('member.update'),organizationId:id,memberId:id,role:z.enum(trainingRoles)}).strict(),
 z.object({action:z.literal('member.remove'),organizationId:id,memberId:id}).strict(),
 z.object({action:z.literal('module.create'),organizationId:id,title:z.string().trim().min(3).max(100),category:z.enum(platformCategories),source:z.enum(['demonstration','manual','blank'])}).strict(),
 z.object({action:z.literal('module.save'),moduleId:id,document:trainingDocumentSchema,sourceText:z.string().trim().max(MAX_SOURCE_TEXT)}).strict(),
 z.object({action:z.literal('module.moments'),moduleId:id,moments:z.array(z.object({frame:jpegData,at:z.number().min(0).max(600),kind:z.enum(['hold','marker']),hands:z.number().int().min(0).max(2),caption:z.string().trim().max(300)}).strict()).max(MAX_MOMENTS)}).strict(),
 z.object({action:z.literal('module.upload'),moduleId:id,kind:z.enum(['demo','manual']),contentType:z.enum(['video/mp4','video/webm','video/quicktime','application/pdf']),size:z.number().int().positive().max(MAX_TRAINING_VIDEO_BYTES)}).strict(),
 z.object({action:z.literal('module.attach'),moduleId:id,kind:z.enum(['demo','manual']),path:z.string().max(220).regex(new RegExp(`^${uuidPart}/${uuidPart}/(demos|manuals)/${uuidPart}\\.(mp4|webm|mov|pdf)$`))}).strict(),
 z.object({action:z.literal('module.transcribe'),moduleId:id,aiConsent:z.literal(true)}).strict(),
 z.object({action:z.literal('module.generate'),moduleId:id,focus:z.string().trim().max(500),aiConsent:z.literal(true)}).strict(),
 z.object({action:z.literal('module.publish'),moduleId:id,audience:z.enum(['all','selected']),memberIds,reviewed:z.literal(true)}).strict(),
 z.object({action:z.literal('module.assign'),moduleId:id,audience:z.enum(['all','selected']),memberIds}).strict(),
 z.object({action:z.literal('module.archive'),moduleId:id}).strict(),
 z.object({action:z.literal('module.coach'),moduleId:id,version:z.number().int().min(1),step:z.number().int().min(0).max(19),frames:z.array(jpegData).min(1).max(2),consent:z.literal(true),over16:z.literal(true)}).strict(),
 z.object({action:z.literal('progress.save'),moduleId:id,version:z.number().int().min(1),step:z.number().int().min(0).max(19),results:z.array(z.enum(stepResults)).min(1).max(20),completed:z.boolean()}).strict(),
]);
export type TrainingAction = z.infer<typeof trainingActionSchema>;

export function blankTrainingDocument(title:string,category:typeof platformCategories[number]):TrainingDocument {
 return {title,category,objective:'Describe what a learner will be able to do.',materials:[],safety:[],prerequisites:[],steps:[{title:'First step',instruction:'Describe the action to practice.',tip:'',check:'',evidence:[],commonMistakes:[],uncertainty:'',manualAlternative:'',visuallyCheckable:false}],alternatives:[],completionCheck:'Describe the final self-check.'};
}
/** Skeleton steps from tracked moments, for building a module without AI. */
export function stepsFromMoments(moments:TrainingMoment[]):TrainingDocument['steps'] {
 return moments.map((moment,index)=>({
  title:moment.caption.slice(0,100)||`Step ${index+1}`,
  instruction:moment.caption||'Describe what happens in this part of the demonstration.',
  tip:'',check:'',evidence:[],commonMistakes:[],uncertainty:'',manualAlternative:'',visuallyCheckable:moment.hands>0,
  reference:referenceFor(moments,index),
 }));
}
export function referenceFor(moments:TrainingMoment[],index:number):StepReference|undefined {
 const moment=moments[index];if(!moment)return undefined;
 const startSec=index>0?moments[index-1].at:0;
 return {frame:moment.frame,startSec:Math.min(startSec,moment.at),endSec:moment.at,hands:moment.hands};
}
/** Attach the moments the AI chose to its steps; invalid or reused choices are dropped. */
export function applyDraft(draft:TrainingDraft,moments:TrainingMoment[]):TrainingDocument {
 const used=new Set<number>();
 return {...draft.document,steps:draft.document.steps.map((step,index)=>{
  const choice=draft.stepMoments[index];
  if(choice===undefined||choice<0||choice>=moments.length||used.has(choice))return step;
  used.add(choice);
  return {...step,reference:referenceFor(moments,choice)};
 })};
}
export function stripReferences(document:TrainingDocument):LessonDocument { return {...document,steps:document.steps.map(({reference,...step})=>{void reference;return step;})}; }
export function resultSummary(results:StepResult[]) {
 return {visual:results.filter(value=>value==='visual').length,manual:results.filter(value=>value==='manual').length,open:results.filter(value=>value==='pending'||value==='unresolved').length};
}
