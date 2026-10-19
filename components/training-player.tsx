'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { CoachFeedback } from '@/lib/coaching-contract';
import { messageOf } from '@/lib/platform-client';
import { trainingAction, trainingFetch } from '@/lib/training-client';
import { resultSummary, stripReferences, type StepResult, type TrainingModuleView } from '@/lib/training-contract';
import { CameraCoach } from './camera-coach';

export function TrainingPlayer({moduleId,onBack}:{moduleId:string;onBack:()=>void}){
  const [module,setModule]=useState<TrainingModuleView|null>(null);const [message,setMessage]=useState('');
  useEffect(()=>{const abort=new AbortController();setModule(null);setMessage('');trainingFetch<{module:TrainingModuleView}>(`view=module&id=${encodeURIComponent(moduleId)}`,abort.signal).then(data=>setModule(data.module)).catch(error=>{if(!abort.signal.aborted)setMessage(messageOf(error));});return()=>abort.abort();},[moduleId]);
  return <div className="studio-stack"><button type="button" className="button secondary compact training-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>All training</button>{module?<Player key={`${module.id}-${module.version}`} module={module}/>:<p role="status" className="platform-panel">{message||'Loading module…'}</p>}</div>;
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
  return <article className="published-lesson platform-panel"><span className="platform-badge published">Your organization’s training · version {module.version}</span><h2 ref={heading} tabIndex={-1}>{module.document.title}</h2><p>{module.document.objective}</p>
    {!module.trackProgress&&<p className="studio-review-note">Preview mode: progress is only recorded for learners.</p>}
    <details><summary>Materials, prerequisites and safety</summary><h3>What you need</h3><ul>{module.document.materials.map((item,index)=><li key={index}>{item}</li>)}</ul>{module.document.prerequisites.length>0&&<><h3>Before you begin</h3><ul>{module.document.prerequisites.map((item,index)=><li key={index}>{item}</li>)}</ul></>}<h3>Safety and limits</h3><ul>{module.document.safety.map((item,index)=><li key={index}>{item}</li>)}</ul></details>
    {module.hasVideo&&<details onToggle={event=>{if(event.currentTarget.open&&!videoUrl)void video();}}><summary>Watch the instructor’s demonstration</summary>{videoUrl?<video controls playsInline preload="metadata" className="studio-video" src={videoUrl} onError={()=>setVideoMessage('The video link may have expired. Reload it to continue.')} aria-label={`${module.document.title} demonstration`}/>:<p role="status">{videoMessage||'Loading demonstration…'}</p>}{videoMessage&&<button className="button secondary compact" type="button" onClick={video}>Try video again</button>}</details>}
    {completed?<div className="lesson-copy" aria-live="polite"><h3>Module complete</h3><p>{module.document.completionCheck}</p><p>{summary.visual} checkpoints confirmed by camera, {summary.manual} checked by you, {summary.open} still open.</p><ul>{steps.map((item,index)=><li key={index}>{item.title}: {results[index]==='visual'?'confirmed by camera':results[index]==='manual'?'self-checked':'open'}</li>)}</ul><p>Camera feedback does not certify safety or competence. Ask your instructor about any step you are unsure of.</p><button type="button" className="button primary compact" onClick={()=>{setCompleted(false);setStep(0);setResults(steps.map(()=>'pending'));}}>Practice again</button></div>
    :<><div className="lesson-copy" aria-live="polite"><p className="lesson-step">Step {step+1} of {steps.length}</p><h3>{current.title}</h3>{reference&&<figure className="training-reference"><img src={reference} alt={`Your instructor’s result for step ${step+1}`}/><figcaption>From your instructor’s demonstration</figcaption></figure>}<p>{current.instruction}</p>{current.tip&&<p className="lesson-tip">{current.tip}</p>}<p className="lesson-check"><Check size={18} aria-hidden="true"/>{current.check}</p>{current.commonMistakes.length>0&&<details><summary>Common mistakes and corrections</summary><ul>{current.commonMistakes.map((item,index)=><li key={index}>{item}</li>)}</ul></details>}<p className="platform-small">{current.visuallyCheckable?`If the view is uncertain: ${current.uncertainty}`:'This checkpoint needs your own check.'} {current.manualAlternative}</p></div>
      <div className="lesson-controls"><button type="button" className="button secondary compact" disabled={step===0} onClick={()=>setStep(value=>value-1)}>Previous step</button><button type="button" className="button primary compact" onClick={()=>next()}>{step===steps.length-1?'Finish with my own check':'Continue with my own check'}<ArrowRight size={16} aria-hidden="true"/></button></div>
      <button type="button" className="button secondary compact" style={{marginTop:12}} onClick={()=>next('unresolved')}>{step===steps.length-1?'Finish unresolved':'Continue unresolved'}</button>
      <CameraCoach skill="tie" step={step} organizationModule publishedLesson={{id:module.id,version:module.version,document:coachDocument}} onFeedback={recordFeedback} onAutoAdvance={resultStep=>{if(resultStep===stepRef.current)next('visual');}}/></>}
    <p className="platform-small" role="status">{saveState}</p>
  </article>;
}
