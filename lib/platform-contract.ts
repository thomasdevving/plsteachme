import { z } from 'zod';

export const platformCategories = ['personal-care','clothing','independent-living','diy','hobbies','preparedness'] as const;
export const categoryLabels: Record<typeof platformCategories[number],string> = {'personal-care':'Personal care',clothing:'Clothing & appearance','independent-living':'Independent living',diy:'DIY & repairs',hobbies:'Hobbies & creativity',preparedness:'Everyday preparedness'};
export const VIDEO_BUCKET = 'teacher-demonstrations';
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const CONTRIBUTION_LICENSE_VERSION = '2026-10-17';
const short = z.string().trim().max(500);
const list = z.array(z.string().trim().min(1).max(500)).max(30);
export const lessonStepSchema = z.object({title:z.string().trim().min(1).max(100),instruction:z.string().trim().min(1).max(1500),tip:short,check:short,evidence:list,commonMistakes:list,uncertainty:short,manualAlternative:short,visuallyCheckable:z.boolean()}).strict();
export const lessonDocumentSchema = z.object({title:z.string().trim().min(3).max(100),category:z.enum(platformCategories),objective:z.string().trim().min(10).max(1000),materials:list,safety:list,prerequisites:list,steps:z.array(lessonStepSchema).min(1).max(20),alternatives:list,completionCheck:z.string().trim().min(3).max(1000)}).strict();
export type LessonDocument = z.infer<typeof lessonDocumentSchema>;
export type TeacherProfile = {userId:string;displayName:string;expertise:string;experience:string;qualifications:string;status:'submitted'|'approved'|'changes_requested';reviewNotes:string;createdAt:string;updatedAt:string};
export type CommunityRequest = {id:string;title:string;description:string;category:typeof platformCategories[number];supportCount:number;createdAt:string};
export type StudioLesson = {id:string;teacherId:string;status:'draft'|'submitted'|'changes_requested'|'published';document:LessonDocument;transcript:string;demoPath:string|null;contributionLicense:boolean;trainingOptIn:boolean;reviewNotes:string;version:number;createdAt:string;requestId:string|null;teacherName:string;submittedVersionId:string|null;publishedVersionId:string|null};
export type PublishedLessonSummary = {id:string;title:string;category:typeof platformCategories[number];objective:string;teacherName:string;version:number;publishedAt:string};
export type PublishedLesson = PublishedLessonSummary & {document:LessonDocument;hasVideo:boolean};
export type CoachingReport = {id:string;skill:string;step:number;status:string;confidence:string;observation:string;guidance:string;reason:string;created_at:string;resolved_at:string|null;resolution:string};
export type PlatformMe = {user:{id:string;email:string|undefined};reviewer:boolean;profile:TeacherProfile|null;lessons:StudioLesson[];supportedRequestIds:string[];applications?:TeacherProfile[];reviewQueue?:StudioLesson[];reports?:CoachingReport[]};
export const platformActionSchema = z.discriminatedUnion('action',[
 z.object({action:z.literal('lesson.coach'),id:z.uuid(),version:z.number().int().min(1),step:z.number().int().min(0).max(19),frames:z.array(z.string().max(270000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)).min(1).max(2),consent:z.literal(true),over16:z.literal(true)}).strict(),
 z.object({action:z.literal('request'),title:z.string().trim().min(3).max(100),description:z.string().trim().min(10).max(1000),category:z.enum(platformCategories)}).strict(),
 z.object({action:z.literal('support'),requestId:z.uuid(),support:z.boolean()}).strict(),
 z.object({action:z.literal('apply'),displayName:z.string().trim().min(2).max(80),expertise:z.string().trim().min(10).max(1000),experience:z.string().trim().min(20).max(3000),qualifications:z.string().trim().max(1500),over16:z.literal(true)}).strict(),
 z.object({action:z.literal('create'),document:lessonDocumentSchema,requestId:z.uuid().optional(),contributionLicense:z.literal(true),trainingOptIn:z.boolean().default(false)}).strict(),
 z.object({action:z.literal('save'),lessonId:z.uuid(),document:lessonDocumentSchema,transcript:z.string().trim().max(20000),contributionLicense:z.literal(true),trainingOptIn:z.boolean().default(false)}).strict(),
 z.object({action:z.literal('upload'),lessonId:z.uuid(),contentType:z.enum(['video/mp4','video/webm','video/quicktime']),size:z.number().int().positive().max(MAX_VIDEO_BYTES)}).strict(),
 z.object({action:z.literal('attach'),lessonId:z.uuid(),path:z.string().max(220).regex(/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.(mp4|webm|mov)$/)}).strict(),
 z.object({action:z.literal('generate'),lessonId:z.uuid(),transcript:z.string().trim().min(40).max(20000),frames:z.array(z.string().max(270000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)).max(4),aiConsent:z.literal(true)}).strict(),
 z.object({action:z.literal('transcribe'),lessonId:z.uuid(),aiConsent:z.literal(true)}).strict(),
 z.object({action:z.literal('submit'),lessonId:z.uuid()}).strict(),
 z.object({action:z.literal('withdraw'),lessonId:z.uuid()}).strict(),
 z.object({action:z.literal('reviewApplication'),userId:z.uuid(),expectedUpdatedAt:z.iso.datetime({offset:true}),decision:z.enum(['approve','changes_requested']),notes:z.string().trim().min(10).max(2000)}).strict(),
 z.object({action:z.literal('reviewLesson'),lessonId:z.uuid(),expectedVersionId:z.uuid(),decision:z.enum(['publish','changes_requested']),notes:z.string().trim().min(10).max(2000)}).strict(),
 z.object({action:z.literal('report.resolve'),id:z.uuid(),resolution:z.string().trim().min(10).max(2000)}).strict(),
]);
export type PlatformAction = z.infer<typeof platformActionSchema>;

export function publicationIssues(document:LessonDocument) {
 const issues:string[]=[];
 if (!document.safety.length) issues.push('Add safety guidance, including relevant limits.');
 if (!document.materials.length) issues.push('List the materials needed.');
 document.steps.forEach((step,index)=>{
  if (!step.check || !step.uncertainty || !step.manualAlternative) issues.push(`Step ${index+1} needs a checkpoint, uncertainty guidance, and a manual alternative.`);
  if (step.visuallyCheckable && !step.evidence.length) issues.push(`Step ${index+1} needs observable evidence.`);
 });
 return issues;
}
