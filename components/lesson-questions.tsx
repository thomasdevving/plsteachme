'use client';
import { fetchWithTimeout } from '@/lib/network';
import { useEffect, useId, useRef, useState } from 'react';
import { MessageCircle, Volume2 } from 'lucide-react';
import type { SkillId } from '@/lib/config';
import { answerSchema, type PublishedHelpReference } from '@/lib/lesson-help';
import { useLearnerTrial } from './learner-trial';
import { onlineNow, useConnectivity } from '@/lib/offline/connectivity';

export function LessonQuestions({skill,step,publishedLesson}:{skill:SkillId;step:number;publishedLesson?:PublishedHelpReference}) {
  const trialId=useLearnerTrial();
  const [question,setQuestion]=useState('');
  const [consent,setConsent]=useState(false);
  const [available,setAvailable]=useState(false);
  const [answer,setAnswer]=useState<{answer:string;reminder:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const request=useRef<AbortController|null>(null);
  const id=useId();
  const publishedId=publishedLesson?.id;
  const publishedVersion=publishedLesson?.version;
  const {online}=useConnectivity();
  useEffect(()=>{
    if(!online||!onlineNow()){request.current?.abort();setBusy(false);return;}
    const controller=new AbortController();
    fetchWithTimeout('/api/coaching/session',{signal:controller.signal,cache:'no-store'})
      .then(response=>response.json()).then(data=>{if(!controller.signal.aborted)setAvailable(data.available===true);}).catch(()=>{});
    return ()=>controller.abort();
  },[online]);
  useEffect(()=>{
    request.current?.abort();setAnswer(null);setMessage('');setBusy(false);setQuestion('');
    return ()=>{request.current?.abort();window.speechSynthesis?.cancel();};
  },[skill,step,publishedId,publishedVersion]);
  async function ask(event:React.FormEvent) {
    event.preventDefault();
    if(busy||!consent||!available||!online)return;
    const controller=new AbortController();request.current=controller;
    setBusy(true);setMessage('');setAnswer(null);
    try {
      const context=publishedLesson?{publishedLesson}:{skill};
      const response=await fetch('/api/coaching/question',{method:'POST',headers:{'Content-Type':'application/json',...(trialId?{'x-coaching-session':trialId}:{})},body:JSON.stringify({...context,step,question,consent:true,over16:true}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)])});
      if(controller.signal.aborted)return;
      if(!response.ok){setMessage(response.status===409?'This lesson has changed. Reload it before asking another question.':response.status===404?'This lesson is no longer available. Return to the catalog.':response.status===429?'Please wait ten minutes before asking more questions.':'The coach could not answer. Try again, or use the written tip above.');return;}
      const data=await response.json();
      if(controller.signal.aborted||data.step!==step||(publishedLesson?data.publishedLesson?.id!==publishedId||data.publishedLesson?.version!==publishedVersion:data.skill!==skill))return;
      const parsed=answerSchema.safeParse({answer:data.answer,reminder:data.reminder});
      if(!parsed.success)throw new Error('answer');
      setAnswer(parsed.data);
    }catch{if(!controller.signal.aborted)setMessage('The coach could not answer. Please try again.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <section className="lesson-questions" aria-labelledby={`${id}-heading`}>
    <h4 id={`${id}-heading`}><MessageCircle size={19} aria-hidden="true"/>Ask about this step</h4>
    <p>Ask for a simpler explanation or help understanding the checkpoint. Questions do not change your progress.</p>
    {!online ? <p className="small muted" role="status">Questions need an internet connection. The written instructions and tips work offline.</p> : !available ? <p className="small muted">AI questions will be available when the coach is connected. The written instructions and tips are ready to use.</p> : <form onSubmit={ask}>
      <label htmlFor={`${id}-question`}>Your question</label>
      <textarea id={`${id}-question`} value={question} onChange={e=>setQuestion(e.target.value)} minLength={3} maxLength={600} required rows={3} placeholder="Which end should I hold?"/>
      <label className="help-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I am 16 or older and agree to send this question to OpenAI. Avoid personal details. <a href="/privacy">Privacy details</a>.</label>
      <button type="submit" className="button secondary compact" disabled={busy||!consent}>{busy?'Asking…':'Ask the coach'}</button>
    </form>}
    <div role="status" aria-live="polite" aria-busy={busy}>{message&&<p>{message}</p>}{answer&&<><p>{answer.answer}</p><p className="lesson-tip">{answer.reminder}</p><button type="button" className="button secondary compact" onClick={()=>{if(!window.speechSynthesis){setMessage('Read aloud is not supported in this browser.');return;}window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(`${answer.answer} ${answer.reminder}`);speech.lang='en';window.speechSynthesis.speak(speech);}}><Volume2 size={16} aria-hidden="true"/>Read answer aloud</button><button type="button" className="text-link" onClick={()=>window.speechSynthesis?.cancel()}>Stop reading</button></>}</div>
  </section>;
}
