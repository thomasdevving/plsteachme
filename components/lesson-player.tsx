'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { modules } from '@/lib/modules';
import { skillIds, type SkillId } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import type { CoachFeedback } from '@/lib/coaching-contract';
import { catalogEntries, getCheckpoint, relatedSkills } from '@/lib/learning-catalog';
import { cameraCanConfirm, checkpointLabels, emptyLessonProgress, progressSummary, readProgress, recordCheckpoint, saveLessonProgress, type LessonProgress } from '@/lib/learning-progress';
import { en } from '@/messages/en';
import { SkillIcon } from './illustrations';
import { LessonArtwork } from './lesson-artwork';
import { CameraCoach } from './camera-coach';
import { LessonQuestions } from './lesson-questions';
import { LearnerTrial } from './learner-trial';
import { builtinTrialId } from '@/lib/auth/trial-reference';
import { PROGRESS_EVENT } from '@/lib/learning-progress';
import { trackLearning } from '@/lib/learning-events';
import Link from 'next/link';
import { builtinLessonHref } from '@/lib/lesson-navigation';
import { LessonWorkspace, LessonCoachTools } from './lesson-workspace';

export function LessonPlayer({ skill, name }: { skill: SkillId; name: string }) {
  return <Player key={skill} skill={skill} name={name}/>;
}

function Player({ skill, name }: { skill: SkillId; name: string }) {
  const lesson = modules[skill];
  const [progress,setProgress]=useState<LessonProgress>(()=>emptyLessonProgress(skill));
  const currentProgress=useRef(progress);
  const [ready,setReady]=useState(false);
  const [storageError,setStorageError]=useState(false);
  const [resumed,setResumed]=useState(false);
  const [replay, setReplay] = useState(0);
  const [practice,setPractice]=useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
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
    let next=currentProgress.current;
    if(selfCheck && next.checkpoints[next.step]!=='camera_confirmed')next=recordCheckpoint(next,next.step,'self_checked');
    if(!selfCheck && next.checkpoints[next.step]!=='camera_confirmed')return;
    commit({...next,completed:next.step===lesson.steps.length-1,step:Math.min(next.step+1,lesson.steps.length-1),updatedAt:Date.now()});focusHeading();
  }
  function skip() {
    const next=recordCheckpoint(currentProgress.current,step,'unresolved');
    commit({...next,completed:step===lesson.steps.length-1,step:Math.min(step+1,lesson.steps.length-1)});focusHeading();
  }
  function feedbackReceived(resultStep:number,feedback:CoachFeedback) {
    if(currentProgress.current.step!==resultStep || currentProgress.current.completed)return;
    commit(recordCheckpoint(currentProgress.current,resultStep,cameraCanConfirm(skill,resultStep,feedback)?'camera_confirmed':'unresolved'));
  }
  function restart() {
    const fresh=emptyLessonProgress(skill);currentProgress.current=fresh;setProgress(fresh);
    setStorageError(!saveLessonProgress(skill,null));setResumed(false);setPractice(value=>value+1);focusHeading();
  }
  return <LessonWorkspace
    title={name} subtitle={`${catalogEntries[skill].categories[0]} · Illustrated walkthrough`}
    step={step} steps={lesson.steps.length} completed={completed} skill={skill} className="lesson-player"
    artwork={<><LessonArtwork skill={skill} step={step} replay={replay}/><button type="button" className="lesson-replay motion-toggle" aria-label="Replay this lesson step" onClick={()=>setReplay(value=>value+1)}><RotateCcw size={17} aria-hidden="true"/>Replay</button></>}
    instruction={completed ? <><span className="lesson-step">Walkthrough complete</span><h2 ref={heading} tabIndex={-1}>One more skill to practice.</h2><p>{lesson.outcome}</p><p className="lesson-completion-note">{summary.camera} camera-confirmed visible checkpoints · {summary.self} self-checked · {summary.unresolved} unresolved.</p><p className="lesson-tip">Camera feedback does not certify safety or mastery. Review your checkpoints in Progress.</p></> : <><span className="lesson-step">Step {step+1} of {lesson.steps.length}</span><h2 ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.instruction}</p><p className="lesson-check"><Check size={18} aria-hidden="true"/><span>Before moving on: {current.check}</span></p><p className={`checkpoint-state ${progress.checkpoints[step]}`} data-checkpoint-state={progress.checkpoints[step]}>{checkpointLabels[progress.checkpoints[step]]}</p></>}
    preparation={<><h2>Before you begin</h2><p>{lesson.intro}</p><h3>What you’ll need</h3><ul>{lesson.materials.map(item=><li key={item}>{item}</li>)}</ul><p>{catalogEntries[skill].prerequisite}</p><p className="lesson-safety">{catalogEntries[skill].safety}</p><h3>For this step</h3><p className="lesson-tip">{current.tip}</p><p>{checkpoint.visuallyCheckable?`Visible checkpoint: ${checkpoint.observableEvidence[0]}`:'This step needs your own check; the camera cannot confirm it.'}</p><p><strong>Common mistake:</strong> {checkpoint.commonMistakes[0]}</p><p>{checkpoint.manualAlternative}</p><p className="learning-storage-note">Progress is saved in this browser, and in your account when signed in. Images are not saved with your progress.</p>{ready&&<button type="button" className="learning-text-button" data-reset-lesson onClick={restart}>Reset lesson progress</button>}{resumed&&<p role="status">Your saved practice is ready to continue.</p>}{storageError&&<p role="status">This browser could not save progress. You can keep practicing here.</p>}</>}
    record={<><h2>Your checkpoint record</h2><p>Self-checked and unresolved steps were not conclusively verified by the camera.</p><ol>{lesson.steps.map((item,index)=><li key={item.title}><button type="button" onClick={()=>move(index)}>{index+1}. {item.title}</button><span className={`checkpoint-state ${progress.checkpoints[index]}`}>{checkpointLabels[progress.checkpoints[index]]}</span></li>)}</ol><h3>Keep learning</h3><div className="related-lessons">{relatedSkills(skill).map(item=><Link key={item} href={builtinLessonHref(item)}>{en.skills.names[item]}<ArrowRight size={15} aria-hidden="true"/></Link>)}</div></>}
    controls={<><button type="button" className="button secondary compact" disabled={!ready || step===0&&!completed} onClick={()=>move(completed?lesson.steps.length-1:step-1)} aria-label="Previous lesson step"><ArrowLeft size={17} aria-hidden="true"/>Back</button>{completed?<button type="button" className="button primary compact" onClick={restart}><RotateCcw size={17} aria-hidden="true"/>Practice again</button>:<button type="button" className="button primary compact" disabled={!ready} onClick={()=>advance(true)}>{step===lesson.steps.length-1?'Finish walkthrough':'Next lesson step'}<ArrowRight size={17} aria-hidden="true"/></button>}</>}
    note={!completed?<>{storageError?<p role="status">Progress could not be saved in this browser.</p>:<p className="lesson-passive-note">Next records your own check.</p>}<button type="button" className="learning-text-button unresolved-skip" disabled={!ready} onClick={skip}>Continue with this step unresolved</button></>:<p>Review any unresolved step before trying it independently.</p>}
    coaching={visible=>ready&&<LearnerTrial key={practice} skillId={builtinTrialId(skill)} onResume={savedStep=>{const next=Math.min(savedStep,lesson.steps.length-1);if(practice===0&&next>currentProgress.current.step&&!currentProgress.current.completed)commit({...currentProgress.current,step:next,updatedAt:Date.now()});}} completedSteps={completed?lesson.steps.length:step} totalSteps={lesson.steps.length}>{!completed&&<LessonCoachTools active={visible} camera={active=><CameraCoach compact suspended={!active} skill={skill} step={step} onFeedback={feedbackReceived} onAutoAdvance={resultStep=>{if(currentProgress.current.step===resultStep)advance(false);}}/>} questions={<LessonQuestions skill={skill} step={step}/>}/>}</LearnerTrial>}
  />;
}

export function LessonLibrary({ names }: { names: Copy['skills']['names'] }) {
  return <div className="lesson-library lesson-library-links" aria-label="Choose a lesson">{skillIds.map(skill=><Link key={skill} href={builtinLessonHref(skill)}><SkillIcon skill={skill} size={28}/><span>{names[skill]}</span><ArrowRight size={16} aria-hidden="true"/></Link>)}</div>;
}
