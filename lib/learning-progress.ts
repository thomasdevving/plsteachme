import { skillIds, type SkillId } from './config';
import { modules } from './modules';
import { getCheckpoint } from './learning-catalog';
import type { CoachFeedback } from './coaching-contract';

export const PROGRESS_KEY='plsteach.learning.v1';
export const PROGRESS_EVENT='plsteach-progress-change';
export const LESSON_CONTENT_VERSION=1;
export type CheckpointState='pending'|'camera_confirmed'|'self_checked'|'unresolved';
export type LessonProgress={contentVersion:number;step:number;completed:boolean;checkpoints:CheckpointState[];updatedAt:number};
export type LearningProgress={version:1;lessons:Partial<Record<SkillId,LessonProgress>>};
export const checkpointLabels:Record<CheckpointState,string>={pending:'Not checked',camera_confirmed:'Camera-confirmed visible checkpoint',self_checked:'Self-checked',unresolved:'Unresolved'};
export function emptyLessonProgress(skill:SkillId):LessonProgress {
  return {contentVersion:LESSON_CONTENT_VERSION,step:0,completed:false,checkpoints:modules[skill].steps.map(()=>'pending'),updatedAt:0};
}
export function parseProgress(raw:string|null):LearningProgress {
  const clean:LearningProgress={version:1,lessons:{}};
  try {
    if(!raw || raw.length>20_000)return clean;
    const data=JSON.parse(raw);
    if(data?.version!==1 || !data.lessons || typeof data.lessons!=='object')return clean;
    for(const skill of skillIds) {
      const item=data.lessons[skill];const count=modules[skill].steps.length;
      if(!item || item.contentVersion!==LESSON_CONTENT_VERSION || !Number.isInteger(item.step) || item.step<0 || item.step>=count || typeof item.completed!=='boolean' || !Array.isArray(item.checkpoints) || item.checkpoints.length!==count || !item.checkpoints.every((state:unknown)=>typeof state==='string' && Object.hasOwn(checkpointLabels,state)) || !Number.isFinite(item.updatedAt) || item.updatedAt<0)continue;
      // A stored value is display-only, never an authorization or paid entitlement.
      clean.lessons[skill]={contentVersion:LESSON_CONTENT_VERSION,step:item.step,completed:item.completed,checkpoints:item.checkpoints.map((state:CheckpointState,index:number)=>state==='camera_confirmed'&&!getCheckpoint(skill,index).visuallyCheckable?'unresolved':state),updatedAt:item.updatedAt};
    }
  }catch{/* Corrupt or unavailable storage starts a fresh local session. */}
  return clean;
}
export function readProgress():LearningProgress {
  try{return parseProgress(window.localStorage.getItem(PROGRESS_KEY));}catch{return {version:1,lessons:{}};}
}
export function saveLessonProgress(skill:SkillId,value:LessonProgress|null):boolean {
  try {
    const store=readProgress();
    if(value)store.lessons[skill]=value;else delete store.lessons[skill];
    window.localStorage.setItem(PROGRESS_KEY,JSON.stringify(store));
    window.dispatchEvent(new Event(PROGRESS_EVENT));return true;
  }catch{return false;}
}
export function cameraCanConfirm(skill:SkillId,step:number,feedback:CoachFeedback):boolean {
  return getCheckpoint(skill,step).visuallyCheckable && feedback.status==='looks_right' && feedback.confidence==='high';
}
export function recordCheckpoint(progress:LessonProgress,step:number,state:CheckpointState):LessonProgress {
  const checkpoints=[...progress.checkpoints];checkpoints[step]=state;
  return {...progress,checkpoints,updatedAt:Date.now()};
}
export function progressSummary(progress:LessonProgress) {
  return {
    camera:progress.checkpoints.filter(state=>state==='camera_confirmed').length,
    self:progress.checkpoints.filter(state=>state==='self_checked').length,
    unresolved:progress.checkpoints.filter(state=>state==='pending'||state==='unresolved').length
  };
}
/**
 * The one lesson rule for moving on, shared by the Next button, camera auto-advance and
 * spoken "next". A self-check records 'self_checked' unless the camera already confirmed
 * the visible checkpoint; without a self-check only a camera confirmation can advance.
 */
export function advanceLessonProgress(progress:LessonProgress,stepCount:number,selfCheck:boolean):LessonProgress|null {
  let next=progress;
  if(selfCheck && next.checkpoints[next.step]!=='camera_confirmed')next=recordCheckpoint(next,next.step,'self_checked');
  if(!selfCheck && next.checkpoints[next.step]!=='camera_confirmed')return null;
  return {...next,completed:next.step===stepCount-1,step:Math.min(next.step+1,stepCount-1),updatedAt:Date.now()};
}
