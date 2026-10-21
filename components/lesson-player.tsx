'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { modules } from '@/lib/modules';
import { skillIds, type SkillId } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import type { CoachFeedback } from '@/lib/coaching-contract';
import { catalogEntries, getCheckpoint, relatedSkills } from '@/lib/learning-catalog';
import { advanceLessonProgress, cameraCanConfirm, checkpointLabels, emptyLessonProgress, progressSummary, readProgress, recordCheckpoint, saveLessonProgress, type LessonProgress } from '@/lib/learning-progress';
import { en } from '@/messages/en';
import { SkillIcon } from './illustrations';
import { LessonArtwork } from './lesson-artwork';
import { CameraCoach } from './camera-coach';
import { LessonQuestions } from './lesson-questions';
import { LearnerTrial } from './learner-trial';
import { builtinTrialId } from '@/lib/auth/trial-reference';
import { PROGRESS_EVENT } from '@/lib/learning-progress';
import { trackLearning } from '@/lib/learning-events';
import { VoiceCoach, VoiceSessionProvider, type VoiceActionResult } from './voice-coach';

/** `voice` offers Bolna voice coaching; only routes whose Permissions-Policy allows the microphone set it. */
export function LessonPlayer({ skill, name, voice=false }: { skill: SkillId; name: string; voice?: boolean }) {
  return <Player key={skill} skill={skill} name={name} voice={voice}/>;
}

function Player({ skill, name, voice }: { skill: SkillId; name: string; voice: boolean }) {
  const lesson = modules[skill];
  const [progress,setProgress]=useState<LessonProgress>(()=>emptyLessonProgress(skill));
  const currentProgress=useRef(progress);
  const [ready,setReady]=useState(false);
  const [storageError,setStorageError]=useState(false);
  const [resumed,setResumed]=useState(false);
  const [replay, setReplay] = useState(0);
  const [practice,setPractice]=useState(0);
  const [voiceKeys,setVoiceKeys]=useState<{id:string;token:string}|null>(null);
  const [voicePaused,setVoicePaused]=useState(false);
  const [checkRequest,setCheckRequest]=useState(0);
  const checksActive=useRef(false);
  const onChecksActive=useCallback((active:boolean)=>{checksActive.current=active;},[]);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const {step,completed}=progress;
  const current = lesson.steps[step];
  const checkpoint=getCheckpoint(skill,step);
  const summary=progressSummary(progress);
  useEffect(()=>{
    const saved=readProgress().lessons[skill];
    if(saved){currentProgress.current=saved;setProgress(saved);setResumed(true);}
    setReady(true);
    // Progress synced from the learner's account arrives after load; adopt it until they start.
    const synced=()=>{const next=readProgress().lessons[skill];if(next&&currentProgress.current.updatedAt===0&&next.updatedAt>0){currentProgress.current=next;setProgress(next);setResumed(true);}};
    window.addEventListener(PROGRESS_EVENT,synced);
    return()=>window.removeEventListener(PROGRESS_EVENT,synced);
  },[skill]);
  function commit(next:LessonProgress) {
    const previous=currentProgress.current;
    if(next.step!==previous.step||next.completed!==previous.completed){
      const key=`builtin:${skill}`;
      if(previous.checkpoints.every(state=>state==='pending')&&!previous.completed)trackLearning({lessonKey:key,kind:'lesson_start'});
      if(next.step>previous.step||next.completed&&!previous.completed){const state=next.checkpoints[previous.step];trackLearning({lessonKey:key,kind:'step',step:previous.step,result:state==='pending'?'':state});}
      if(next.completed&&!previous.completed)trackLearning({lessonKey:key,kind:'lesson_complete'});
    }
    currentProgress.current=next;setProgress(next);
    setStorageError(!saveLessonProgress(skill,next));
  }
  function focusHeading(){requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));}
  function move(next:number) {
    commit({...currentProgress.current,completed:false,step:next,updatedAt:Date.now()});focusHeading();
  }
  function advance(selfCheck:boolean) {
    const next=advanceLessonProgress(currentProgress.current,lesson.steps.length,selfCheck);
    if(!next)return false;
    commit(next);focusHeading();return true;
  }
  function skip() {
    const next=recordCheckpoint(currentProgress.current,step,'unresolved');
    commit({...next,completed:step===lesson.steps.length-1,step:Math.min(step+1,lesson.steps.length-1)});focusHeading();
  }
  function feedbackReceived(resultStep:number,feedback:CoachFeedback) {
    if(currentProgress.current.step!==resultStep || currentProgress.current.completed)return;
    commit(recordCheckpoint(currentProgress.current,resultStep,cameraCanConfirm(skill,resultStep,feedback)?'camera_confirmed':'unresolved'));
  }
  // Spoken actions go through the same rules as the buttons. "next" can record a
  // self-check, never a camera confirmation; the camera result alone decides that.
  function voiceAction(action:'next'|'back'|'replay'|'check'):VoiceActionResult {
    const current=currentProgress.current;
    if(action==='next')return {applied:!current.completed&&advance(true),step:currentProgress.current.step};
    if(action==='back'){if(current.step===0||current.completed)return {applied:false,step:current.step};move(current.step-1);return {applied:true,step:current.step-1};}
    if(action==='replay'){setReplay(value=>value+1);return {applied:true,step:current.step};}
    if(!checksActive.current||!getCheckpoint(skill,current.step).visuallyCheckable)return {applied:false,step:current.step};
    setCheckRequest(value=>value+1);return {applied:true,step:current.step};
  }
  function restart() {
    const fresh=emptyLessonProgress(skill);currentProgress.current=fresh;setProgress(fresh);
    setStorageError(!saveLessonProgress(skill,null));setResumed(false);setPractice(value=>value+1);focusHeading();
  }
  return <section className="lesson-player" aria-labelledby={titleId} data-skill={skill}>
    <div className="lesson-overview"><p className="lesson-eyebrow">{catalogEntries[skill].categories[0]} · {lesson.steps.length} guided steps</p><h3 id={titleId}>{name}</h3><p>{lesson.intro}</p><details className="lesson-materials"><summary>What you’ll need</summary><ul>{lesson.materials.map(item=><li key={item}>{item}</li>)}</ul><p>{catalogEntries[skill].prerequisite}</p></details><p className="lesson-safety">{catalogEntries[skill].safety}</p><small>Illustrated walkthrough · optional automatic camera coaching</small><p className="learning-storage-note">Progress is saved in this browser, and in your account when you’re signed in. Images and AI feedback are not saved with your progress.</p>{ready && <button type="button" className="learning-text-button" onClick={restart}>Reset lesson progress</button>}{storageError && <p role="status">This browser could not save progress. You can keep practicing here.</p>}{resumed && <p className="learning-resume" role="status">Your saved practice is ready to continue.</p>}</div>
    <div className="lesson-workspace"><div className="lesson-art"><LessonArtwork skill={skill} step={step} replay={replay}/><button type="button" className="lesson-replay motion-toggle" aria-label="Replay this lesson step" onClick={()=>setReplay(value=>value+1)}><RotateCcw size={17} aria-hidden="true"/>Replay</button></div>
      <div className="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={completed ? lesson.steps.length : step} aria-valuetext={completed ? 'Walkthrough complete' : `Step ${step+1} of ${lesson.steps.length}`}>{lesson.steps.map((_,i)=><span key={i} className={completed || i<step ? 'complete' : i===step ? 'current' : ''}/>)}</div>
      <div className="lesson-copy" aria-live="polite">{completed ? <><span className="lesson-step">Walkthrough complete</span><h4 ref={heading} tabIndex={-1}>One more skill to practice.</h4><p>{lesson.outcome}</p><p className="lesson-completion-note">{summary.camera} camera-confirmed visible checkpoints · {summary.self} self-checked · {summary.unresolved} unresolved.</p><p>Camera confirmation covers the visible checkpoint only. It does not certify comfort, safety or mastery.</p></> : <><span className="lesson-step">Step {step+1} of {lesson.steps.length}</span><h4 ref={heading} tabIndex={-1}>{current.title}</h4><p>{current.instruction}</p><p className="lesson-tip">{current.tip}</p><p className="lesson-check"><Check size={18} aria-hidden="true"/><span>Before moving on: {current.check}</span></p><p className={`checkpoint-state ${progress.checkpoints[step]}`} data-checkpoint-state={progress.checkpoints[step]}>{checkpointLabels[progress.checkpoints[step]]}</p><details className="checkpoint-guide"><summary>What the coach can check</summary>{checkpoint.visuallyCheckable?<><p>Visible checkpoint: {checkpoint.observableEvidence[0]}</p><p>Only this visible result can be camera-confirmed. Check comfort, safety and the written instructions for yourself.</p></>:<p>This step needs your own check. Camera coaching can offer context, but cannot confirm or automatically advance it.</p>}<p><strong>Common mistake:</strong> {checkpoint.commonMistakes[0]}</p><p>{checkpoint.manualAlternative}</p></details></>}</div>
      {completed && <div className="completion-checkpoints"><h5>Your checkpoint record</h5><p>Self-checked and unresolved steps were not conclusively verified by the camera. Revisit any step to practice again.</p><ol>{lesson.steps.map((item,index)=><li key={item.title}><button type="button" onClick={()=>move(index)}>{index+1}. {item.title}</button><span className={`checkpoint-state ${progress.checkpoints[index]}`}>{checkpointLabels[progress.checkpoints[index]]}</span></li>)}</ol><h5>Keep learning</h5><div className="related-lessons">{relatedSkills(skill).map(item=><a key={item} href={`/learn?skill=${item}`}>{en.skills.names[item]}<ArrowRight size={15} aria-hidden="true"/></a>)}</div></div>}
      <div className="lesson-controls"><button type="button" className="button secondary compact" disabled={!ready || step===0 && !completed} onClick={()=>move(completed ? lesson.steps.length-1 : step-1)} aria-label="Previous lesson step"><ArrowLeft size={17} aria-hidden="true"/>Back</button>{completed ? <button type="button" className="button primary compact" onClick={restart}><RotateCcw size={17} aria-hidden="true"/>Practice again</button> : <button type="button" className="button primary compact" disabled={!ready} onClick={()=>advance(true)}>{step===lesson.steps.length-1 ? 'Finish walkthrough' : 'Next lesson step'}<ArrowRight size={17} aria-hidden="true"/></button>}</div>
      {!completed && <><p className="manual-check-note">Next records your own check unless the visible checkpoint is already camera-confirmed.</p><button type="button" className="learning-text-button unresolved-skip" disabled={!ready} onClick={skip}>Continue with this step unresolved</button></>}
      {ready && <LearnerTrial key={practice} skillId={builtinTrialId(skill)} onResume={savedStep=>{const next=Math.min(savedStep,lesson.steps.length-1);if(practice===0&&next>currentProgress.current.step&&!currentProgress.current.completed)commit({...currentProgress.current,step:next,updatedAt:Date.now()});}} completedSteps={completed?lesson.steps.length:step} totalSteps={lesson.steps.length}><VoiceSessionProvider value={voiceKeys}>{voice&&<VoiceCoach skill={skill} step={step} completed={completed} onAction={voiceAction} onSessionChange={setVoiceKeys} onPausedChange={setVoicePaused}/>}{!completed&&<><CameraCoach skill={skill} step={step} onFeedback={feedbackReceived} holdChecks={voicePaused} checkRequest={checkRequest} onChecksActive={onChecksActive} onAutoAdvance={voiceKeys?undefined:resultStep=>{if(currentProgress.current.step===resultStep)advance(false);}}/><LessonQuestions skill={skill} step={step}/></>}</VoiceSessionProvider></LearnerTrial>}
    </div>
  </section>;
}

export function LessonLibrary({ names }: { names: Copy['skills']['names'] }) {
  const [skill,setSkill] = useState<SkillId>('tie');
  const id = useId();
  return <div className="lesson-library"><div className="hero-module-options" role="group" aria-label="Choose a lesson">{skillIds.map(item=><button type="button" key={item} aria-pressed={skill===item} aria-controls={id} onClick={()=>setSkill(item)}><SkillIcon skill={item} size={23}/><span>{names[item]}</span>{skill===item && <Check size={14} aria-hidden="true"/>}</button>)}</div><div id={id}><LessonPlayer skill={skill} name={names[skill]}/></div></div>;
}
