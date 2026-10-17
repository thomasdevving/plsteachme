'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { SkillId } from '@/lib/config';
import type { CoachFeedback } from '@/lib/coaching-contract';
import type { PublishedHelpReference } from '@/lib/lesson-help';

export function ReportFeedback({skill,step,feedback,onOpen,publishedLesson}:{skill:SkillId;step:number;feedback:CoachFeedback;onOpen?:()=>void;publishedLesson?:PublishedHelpReference}) {
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState('');
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [message,setMessage]=useState('');
  const request=useRef<AbortController|null>(null);
  const id=useId();
  const publishedId=publishedLesson?.id;
  const publishedVersion=publishedLesson?.version;
  useEffect(()=>{setOpen(false);setReason('');setConsent(false);setBusy(false);setSent(false);setMessage('');return ()=>request.current?.abort();},[skill,step,feedback,publishedId,publishedVersion]);
  async function send(event:React.FormEvent) {
    event.preventDefault();if(!consent||busy||sent)return;
    const controller=new AbortController();request.current=controller;setBusy(true);setMessage('');
    try {
      const context=publishedLesson?{publishedLesson}:{skill};
      const response=await fetch('/api/coaching/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,step,feedback,reason,consent:true}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      if(controller.signal.aborted)return;
      if(response.ok){setSent(true);setMessage('Report saved for human review. Thank you.');}
      else setMessage(response.status===409?'This lesson has changed. Reload it before sending a report. Your report has not been saved.':response.status===404?'This lesson is no longer available. Your report has not been saved.':response.status===401?'Start a coaching session again before reporting.':response.status===429?'Please wait before sending another report.':'Reports are unavailable right now. Your report has not been saved.');
    }catch{if(!controller.signal.aborted)setMessage('Your report could not be saved. Please try again.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <div className="feedback-report"><button type="button" className="text-link" aria-expanded={open} aria-controls={id} onClick={()=>{if(!open)onOpen?.();setOpen(!open);}}>Report incorrect feedback</button>{open&&<div id={id}><p>Send this feedback and your explanation to a human reviewer. No images or video are included. Reports do not train or update the coach automatically.</p><form onSubmit={send}><label htmlFor={`${id}-reason`}>What did the coach get wrong?</label><textarea id={`${id}-reason`} value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={1000} rows={3} required disabled={sent}/><label className="help-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={sent}/>I agree to save this feedback and explanation for review.</label><button type="submit" className="button secondary compact" disabled={busy||sent||!consent}>{sent?'Report saved':busy?'Saving…':'Send report'}</button></form><p role="status">{message}</p></div>}</div>;
}
