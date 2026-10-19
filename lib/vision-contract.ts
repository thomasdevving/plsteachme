import { z } from 'zod';
import { skillIds, type SkillId } from './config';
import { modules } from './modules';
import { getCheckpoint } from './learning-catalog';
import { FEATURE_LENGTH } from './vision/features';
import type { Evaluation, VisionModel } from './vision/model';
import type { LessonDocument } from './platform-contract';

// A target is the lesson a specialized model recognizes: a built-in skill or a
// published teacher lesson.
export const targetSchema = z.string().regex(new RegExp(`^(builtin:(${skillIds.join('|')})|lesson:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$`));
export const builtinTarget=(skill:SkillId)=>`builtin:${skill}`;
export const lessonTarget=(id:string)=>`lesson:${id}`;

/** Labels: `other` (in between steps), `s<n>` (step n's correct result), `m<n>` (step n's common mistake). */
export const labelSchema = z.string().regex(/^(other|s(1?[0-9])|m(1?[0-9]))$/);
export type LabelDefinition = {id:string;kind:'other'|'result'|'mistake';step:number|null;title:string;description:string};
export type TargetSteps = {title:string;check:string;mistake:string}[];
export function targetLabels(steps:TargetSteps):LabelDefinition[] {
 return [
  {id:'other',kind:'other',step:null,title:'In between',description:'Hands moving between steps, setting up, or anything that is not a finished step.'},
  ...steps.flatMap((step,index)=>[
   {id:`s${index}`,kind:'result' as const,step:index,title:`Step ${index+1} done right`,description:step.check||step.title},
   ...(step.mistake?[{id:`m${index}`,kind:'mistake' as const,step:index,title:`Step ${index+1} mistake`,description:step.mistake}]:[]),
  ]),
 ];
}
export function builtinSteps(skill:SkillId):TargetSteps { return modules[skill].steps.map((step,index)=>({title:step.title,check:step.check,mistake:getCheckpoint(skill,index).commonMistakes[0]||''})); }
export function lessonSteps(document:LessonDocument):TargetSteps { return document.steps.map(step=>({title:step.title,check:step.check,mistake:step.commonMistakes[0]||''})); }

export const MIN_CLIP_FRAMES = 10;
export const MAX_CLIP_FRAMES = 300;
export const MAX_CLIPS_PER_TARGET = 400;
export const MIN_CLIPS_PER_LABEL = 3;
const frame = z.array(z.number().min(-100).max(100)).length(FEATURE_LENGTH);

/** Activation requires these on clips the model never trained on. */
export const QUALITY_GATE = {macroF1:0.8,clipAccuracy:0.8,minRecall:0.6,minValidationClipsPerLabel:1};
export function qualityGate(evaluation:Evaluation) {
 const reasons:string[]=[];
 if(evaluation.macroF1<QUALITY_GATE.macroF1)reasons.push(`Macro F1 is ${pct(evaluation.macroF1)}; ${pct(QUALITY_GATE.macroF1)} is required.`);
 if(evaluation.clipAccuracy<QUALITY_GATE.clipAccuracy)reasons.push(`Clip accuracy is ${pct(evaluation.clipAccuracy)}; ${pct(QUALITY_GATE.clipAccuracy)} is required.`);
 for(const item of evaluation.perLabel){
  if(item.clips<QUALITY_GATE.minValidationClipsPerLabel)reasons.push(`${item.label} has no held-out clip to test on.`);
  else if(item.recall<QUALITY_GATE.minRecall)reasons.push(`${item.label} is recognized ${pct(item.recall)} of the time; ${pct(QUALITY_GATE.minRecall)} is required.`);
 }
 return {passed:!reasons.length,reasons};
}
export const pct=(value:number)=>`${Math.round(value*100)}%`;

export type VisionModelSummary = {id:string;target:string;version:number;status:'candidate'|'active'|'retired';labels:string[];metrics:Evaluation;gate:{passed:boolean;reasons:string[]};datasetClips:number;trainedAt:string;activatedAt:string|null;shadow:{checks:number;agreements:number}};
export type VisionTarget = {target:string;title:string;steps:TargetSteps;labels:LabelDefinition[];clipCounts:Record<string,number>;models:VisionModelSummary[];canContribute:boolean};
export type ActiveModel = {id:string;target:string;version:number;model:VisionModel};
export type ClipSummary = {id:string;label:string;frames:number;handRate:number;source:'camera'|'video';createdAt:string;mine:boolean};

export const visionActionSchema = z.discriminatedUnion('action',[
 z.object({action:z.literal('clip.add'),target:targetSchema,label:labelSchema,source:z.enum(['camera','video']),frames:z.array(frame).min(MIN_CLIP_FRAMES).max(MAX_CLIP_FRAMES),consent:z.literal(true)}).strict(),
 z.object({action:z.literal('clip.delete'),target:targetSchema,clipId:z.uuid()}).strict(),
 z.object({action:z.literal('model.train'),target:targetSchema}).strict(),
 z.object({action:z.literal('model.activate'),target:targetSchema,modelId:z.uuid()}).strict(),
 z.object({action:z.literal('model.retire'),target:targetSchema,modelId:z.uuid()}).strict(),
 // Shadow comparison of the on-device model with the cloud coach's verdict. No images or landmarks.
 z.object({action:z.literal('shadow'),modelId:z.uuid(),step:z.number().int().min(0).max(19),predicted:z.union([labelSchema,z.literal('uncertain')]),confidence:z.number().min(0).max(1),coachStatus:z.enum(['looks_right','adjust','unclear','not_verifiable','stop'])}).strict(),
]);
export type VisionAction = z.infer<typeof visionActionSchema>;

/** Whether an on-device prediction agrees with the cloud coach's verdict for this step. */
export function shadowAgrees(predicted:string,step:number,coachStatus:string) {
 if(coachStatus==='looks_right')return predicted===`s${step}`;
 if(coachStatus==='adjust')return predicted!==`s${step}`&&predicted!=='uncertain';
 return null; // Unclear or non-visual verdicts cannot score the model.
}
export const MODEL_THRESHOLD = 0.6;
export function readPrediction(labels:string[],probs:number[]) {
 const top=Math.max(...probs);const label=labels[probs.indexOf(top)];
 return {label:top>=MODEL_THRESHOLD?label:'uncertain',confidence:top};
}
