'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Cpu } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/network';
import type { CoachFeedback } from '@/lib/coaching-contract';
import { readPrediction, targetLabels, type ActiveModel, type TargetSteps } from '@/lib/vision-contract';
import { createSmoother, predict } from '@/lib/vision/model';
import { startLandmarkLoop } from '@/lib/vision/landmark-loop';

/**
 * The specialized model for this lesson, if one is active. It runs on the
 * learner's device in shadow mode: it shows what it recognizes and is scored
 * against the cloud coach, but never confirms or advances a step itself.
 */
export function OnDeviceModel({target,steps,step,video,running,feedback}:{target:string;steps:TargetSteps;step:number;video:RefObject<HTMLVideoElement|null>;running:boolean;feedback:{step:number;value:CoachFeedback}|null}){
  const [active,setActive]=useState<ActiveModel|null>(null);const [prediction,setPrediction]=useState<{label:string;confidence:number}|null>(null);const [failed,setFailed]=useState(false);
  const latest=useRef<{label:string;confidence:number;step:number}|null>(null);
  useEffect(()=>{const abort=new AbortController();setActive(null);fetchWithTimeout(`/api/vision?view=active&target=${encodeURIComponent(target)}`,{cache:'no-store',signal:abort.signal}).then(response=>response.ok?response.json():null).then(data=>{if(!abort.signal.aborted&&data?.model)setActive(data.model);}).catch(()=>{});return()=>abort.abort();},[target]);
  useEffect(()=>{
    latest.current=null;setPrediction(null);
    if(!active||!running||!video.current)return;
    const smoother=createSmoother(active.model.labels.length);
    return startLandmarkLoop(video.current,features=>{const value=readPrediction(active.model.labels,smoother.push(predict(active.model,features)));latest.current={...value,step};setPrediction(value);},150,()=>setFailed(true));
  },[active,running,step,video]);
  // Every cloud verdict scores the on-device prediction made for the same step.
  useEffect(()=>{
    const current=latest.current;
    if(!active||!feedback||!current||current.step!==feedback.step)return;
    void fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'shadow',modelId:active.id,step:feedback.step,predicted:current.label,confidence:Math.round(current.confidence*1000)/1000,coachStatus:feedback.value.status}),keepalive:true}).catch(()=>{});
  },[feedback,active]);
  if(!active||!running)return null;
  const labels=targetLabels(steps);const definition=labels.find(item=>item.id===prediction?.label);
  const text=failed?'Hand tracking is unavailable in this browser.':!prediction?'Starting…':prediction.label==='uncertain'?'Not sure yet.':definition?.kind==='result'?(definition.step===step?`Step ${step+1} result recognized`:`Looks like step ${(definition.step??0)+1}, not step ${step+1}`):definition?.kind==='mistake'?`Possible mistake: ${definition.description}`:'Working on it…';
  return <div className="on-device-model" role="status" aria-live="polite"><Cpu size={16} aria-hidden="true"/><div><strong>On-device model v{active.version} (beta)</strong><span>{text}{prediction&&prediction.label!=='uncertain'?` · ${Math.round(prediction.confidence*100)}%`:''}</span><small>Runs on your device and never moves you forward by itself.</small></div></div>;
}
