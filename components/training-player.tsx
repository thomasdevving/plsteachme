'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check } from 'lucide-react';
import type { CoachFeedback } from '@/lib/coaching-contract';
import { messageOf } from '@/lib/platform-client';
import { trainingAction, trainingFetch } from '@/lib/training-client';
import { resultSummary, stripReferences, type StepResult, type TrainingModuleView } from '@/lib/training-contract';
import { CameraCoach } from './camera-coach';
import { LessonWorkspace, LessonCoachTools, LessonLoadState } from './lesson-workspace';

export function TrainingPlayer({moduleId}:{moduleId:string}){
  const [module,setModule]=useState<TrainingModuleView|null>(null);const [message,setMessage]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{const abort=new AbortController();setModule(null);setMessage('');trainingFetch<{module:TrainingModuleView}>(`view=module&id=${encodeURIComponent(moduleId)}`,abort.signal).then(data=>setModule(data.module)).catch(error=>{if(!abort.signal.aborted)setMessage(messageOf(error));});return()=>abort.abort();},[moduleId,retry]);
  return module?<Player key={`${module.id}-${module.version}`} module={module}/>:<LessonLoadState training message={message||'Loading your training module…'} retry={message?()=>setRetry(value=>value+1):undefined}/>;
}

function Player({module}:{module:TrainingModuleView}){
  const steps=module.document.steps;const saved=module.progress;
  const [step,setStep]=useState(saved&&!saved.completedAt?Math.min(saved.step,steps.length-1):0);const [results,setResults]=useState<StepResult[]>(saved&&!saved.completedAt&&saved.results.length===steps.length?saved.results:steps.map(()=>'pending'));const [completed,setCompleted]=useState(false);
  const [saveState,setSaveState]=useState('');const [videoUrl,setVideoUrl]=useState('');const [videoMessage,setVideoMessage]=useState('');const heading=useRef<HTMLHeadingElement>(null);const stepRef=useRef(step);stepRef.current=step;const first=useRef(true);
  const current=steps[step];const reference=current?.reference?module.frames[current.reference.frame]:undefined;
  const coachDocument=useRef(stripReferences(module.document)).current;
  useEffect(()=>{
    if(first.current){first.current=false;return;}
    if(!module.trackProgress)return;
    let active=true;setSaveState('Saving progress…');
    const timer=setTimeout(()=>{trainingAction<{results?:StepResult[]}>({action:'progress.save',moduleId:module.id,version:module.version,step,results,completed}).then(()=>{if(active)setSaveState('Progress saved for your organization.');}).catch(error=>{if(active)setSaveState(`${messageOf(error)} Your place is kept on this page.`);});},completed?0:700);
    return()=>{active=false;clearTimeout(timer);};
  },[module.id,module.version,module.trackProgress,step,results,completed]);
  const recordFeedback=useCallback((index:number,feedback:CoachFeedback)=>{if(index!==stepRef.current)return;setResults(previous=>previous.map((value,i)=>{if(i!==index)return value;if(feedback.status==='looks_right'&&feedback.confidence==='high'&&steps[index]?.visuallyCheckable)return 'visual';return value==='visual'?value:'unresolved';}));},[steps]);
  function next(result:StepResult='manual'){setResults(previous=>previous.map((value,index)=>index===step?(result==='manual'&&value==='visual'?'visual':result):value));if(step===steps.length-1)setCompleted(true);else setStep(value=>value+1);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));}
  async function video(){setVideoMessage('');try{const data=await trainingFetch<{url:string}>(`view=video&id=${module.id}`);setVideoUrl(data.url);}catch(error){setVideoMessage(messageOf(error));}}
  const summary=resultSummary(results);
  const revisit=(index:number)=>{setCompleted(false);setStep(index);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));};
  return <LessonWorkspace feedback={{lessonKey:`training:${module.id}`,version:module.version}} title={module.document.title} subtitle={`Your organization’s training · Version ${module.version}`} backHref="/training" backLabel="All training" step={step} steps={steps.length} completed={completed} className="published-lesson training-lesson"
    artwork={reference?<img src={reference} alt={`Your instructor’s result for step ${step+1}`}/>:<div className="lesson-demonstration">{videoUrl?<video controls playsInline src={videoUrl} onError={()=>setVideoMessage("The video link may have expired. Try loading the demonstration again.")} aria-label={`${module.document.title} demonstration`}/>:<><BookOpen size={72} aria-hidden="true"/><p>{module.hasVideo?'Learn from your instructor’s demonstration.':'Follow the written step and check the result.'}</p>{module.hasVideo&&<button className="button secondary compact" type="button" onClick={video}>Watch demonstration</button>}</>}{videoMessage&&<div><p role="status">{videoMessage}</p><button type="button" className="button secondary compact" onClick={video}>Try video again</button></div>}</div>}
    instruction={completed?<><span className="lesson-step">Module complete</span><h2 ref={heading} tabIndex={-1}>Keep practicing.</h2><p>{module.document.completionCheck}</p><p>{summary.visual} checkpoints confirmed by camera, {summary.manual} checked by you, {summary.open} still open.</p><p className="lesson-tip">Ask your instructor about any step you are unsure of. Camera feedback does not certify competence.</p></>:<><p className="lesson-step">Step {step+1} of {steps.length}</p><h2 ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.instruction}</p><p className="lesson-check"><Check size={18} aria-hidden="true"/>{current.check}</p><p className="checkpoint-state">{results[step]==='visual'?'Confirmed by camera':results[step]==='manual'?'Self-checked':results[step]==='unresolved'?'Unresolved':'Not checked yet'}</p></>}
    preparation={<><h2>Before you begin</h2><p>{module.document.objective}</p>{!module.trackProgress&&<p className="studio-review-note">Preview mode: progress is only recorded for learners.</p>}<h3>What you need</h3><ul>{module.document.materials.map((item,index)=><li key={index}>{item}</li>)}</ul><h3>Safety and prerequisites</h3><ul>{[...module.document.prerequisites,...module.document.safety].map((item,index)=><li key={index}>{item}</li>)}</ul><h3>For this step</h3><p>{current.tip}</p><p>{current.visuallyCheckable?`If the view is uncertain: ${current.uncertainty}`:'This checkpoint needs your own check.'} {current.manualAlternative}</p><ul>{current.commonMistakes.map((item,index)=><li key={index}>{item}</li>)}</ul>{module.hasVideo&&<details onToggle={event=>{if(event.currentTarget.open&&!videoUrl)void video();}}><summary>Watch the instructor’s demonstration</summary>{videoUrl?<video controls playsInline src={videoUrl} className="studio-video" aria-label={`${module.document.title} demonstration`}/>:<p role="status">{videoMessage||'Loading demonstration…'}</p>}</details>}</>}
    record={<><h2>Your checkpoint record</h2><ol>{steps.map((item,index)=><li key={index}><button type="button" onClick={()=>revisit(index)}>{index+1}. {item.title}</button><span>{results[index]==='visual'?'confirmed by camera':results[index]==='manual'?'self-checked':'open'}</span></li>)}</ol></>}
    controls={<><button type="button" className="button secondary compact" disabled={step===0&&!completed} onClick={()=>revisit(completed?steps.length-1:step-1)}>Previous step</button>{completed?<button type="button" className="button primary compact" onClick={()=>{setCompleted(false);setStep(0);setResults(steps.map(()=>'pending'));}}>Practice again</button>:<button type="button" className="button primary compact" onClick={()=>next()}>{step===steps.length-1?'Finish with my own check':'Continue with my own check'}<ArrowRight size={16} aria-hidden="true"/></button>}</>}
    note={<><p role={saveState?"status":undefined} className={saveState?undefined:"lesson-passive-note"}>{saveState||'Your instructor can see your learning progress.'}</p>{!completed&&<button type="button" className="learning-text-button" onClick={()=>next('unresolved')}>{step===steps.length-1?'Finish unresolved':'Continue unresolved'}</button>}</>}
    coaching={visible=>!completed&&<LessonCoachTools active={visible} camera={active=><CameraCoach compact suspended={!active} skill="tie" step={step} organizationModule publishedLesson={{id:module.id,version:module.version,document:coachDocument}} onFeedback={recordFeedback} onAutoAdvance={resultStep=>{if(resultStep===stepRef.current)next('visual');}}/>}/>}
  />;
}
