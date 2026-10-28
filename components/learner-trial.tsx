'use client';
import { fetchWithTimeout } from '@/lib/network';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Trial } from '@/lib/auth/trial';
import { trialResumeHref } from '@/lib/auth/trial-reference';
import { onlineNow, useConnectivity } from '@/lib/offline/connectivity';

export const OFFLINE_COACHING_MESSAGE='Camera coaching needs an internet connection. You can keep practicing with the illustrated steps.';

const TrialContext=createContext<string|undefined>(undefined);
export const useLearnerTrial=()=>useContext(TrialContext);
type Account={user:{id:string;email?:string}|null;configured:boolean;trial?:Trial|null};
export function LearnerTrial({skillId,completedSteps,totalSteps,children,onResume}:{skillId:string;completedSteps:number;totalSteps:number;children:ReactNode;onResume?:(step:number)=>void}){
 const [account,setAccount]=useState<Account|null>(null),[available,setAvailable]=useState<boolean|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const saved=useRef(0);
 const resume=useRef(onResume);resume.current=onResume;
 // Coaching is online-only: nothing is requested, queued or simulated while offline.
 const {online}=useConnectivity();
 useEffect(()=>{if(!online||!onlineNow())return;const abort=new AbortController();setAccount(null);setMessage('');
  Promise.all([fetchWithTimeout('/api/auth/session',{cache:'no-store',signal:abort.signal}),fetchWithTimeout('/api/coaching/session',{cache:'no-store',signal:abort.signal})]).then(async([auth,ai])=>{if(!auth.ok||!ai.ok)throw new Error();const [value,service]=await Promise.all([auth.json(),ai.json()]);if(!abort.signal.aborted){setAccount(value);setAvailable(service.available===true);saved.current=value.trial?.completed_steps||0;if(value.user&&value.trial?.skill_id===skillId&&!value.trial.completed_at)resume.current?.(saved.current);}}).catch(()=>{if(!abort.signal.aborted)setMessage('Your coaching account could not load. Reload to try again.');});
  return()=>abort.abort();
 },[skillId,online]);
 const trial=account?.trial;const active=Boolean(account?.user&&trial&&!trial.completed_at&&trial.skill_id===skillId);
 useEffect(()=>{
  if(!online||!onlineNow()||!active||!trial||completedSteps<=saved.current)return;
  let current=true;setBusy(true);setMessage('');
  fetchWithTimeout('/api/trial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'progress',sessionId:trial.id,completedSteps:Math.min(completedSteps,totalSteps)})}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error();if(current){saved.current=Math.max(saved.current,completedSteps);if(data.trial?.completed_at)setAccount(value=>value?{...value,trial:data.trial}:value);}}).catch(()=>{if(current)setMessage('Your coaching progress could not be saved. Retry before leaving.');}).finally(()=>{if(current)setBusy(false);});
  return()=>{current=false;};
 },[online,active,trial,completedSteps,totalSteps,retry]);
 async function start(){setBusy(true);setMessage('');try{const response=await fetchWithTimeout('/api/trial',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',skillId})});const data=await response.json();if(data.trial)setAccount(value=>value?{...value,trial:data.trial}:value);if(!response.ok)throw new Error(data.error||'Your session could not start.');saved.current=data.trial.completed_steps;}catch(error){setMessage(error instanceof Error?error.message:'Your session could not start.');}finally{setBusy(false);}}
 const next=typeof window==='undefined'?'/learn':window.location.pathname+window.location.search;
 if(!online)return completedSteps>=totalSteps?null:<aside className="platform-account platform-empty coaching-offline" aria-label="Coaching session"><strong>Coaching is paused while you’re offline</strong><p role="status">{OFFLINE_COACHING_MESSAGE}</p><p className="small muted">When you’re back online, start camera coaching again yourself. Nothing was recorded or sent while you were offline.</p></aside>;
 if(active)return <TrialContext.Provider value={trial!.id}>{children}{message&&<p role="alert">{message} <button type="button" className="text-link" disabled={busy} onClick={()=>setRetry(value=>value+1)}>Retry saving progress</button></p>}</TrialContext.Provider>;
 if(completedSteps>=totalSteps)return message?<p role="status">{message}</p>:null;
 return <aside className="platform-account platform-empty" aria-label="Coaching session"><strong>One free coaching session</strong>{!account?<p role="status">{message||'Checking your account…'}</p>:available===false?<p>Camera coaching isn’t connected yet. Your free session has not been used. You can still follow every illustrated lesson.</p>:!account.user?<><p>Create an account for one free coaching session. Illustrated lessons remain free to explore.</p><div className="session-buttons"><a className="button primary compact" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</a><a className="button secondary compact" href={`/login?next=${encodeURIComponent(next)}`}>Log in</a></div></>:trial?.completed_at?<><p>You’ve used your free session. More coaching is coming soon.</p><a className="text-link" href="/subscriptions">Explore plans</a></>:trial?<><p>Your free session is already reserved for another lesson.</p><a className="text-link" href={trialResumeHref(trial.skill_id)}>Resume your session</a></>:<><p>Use your one free session for this lesson, including camera coaching and questions. You can pause and resume until you finish.</p><button className="button primary compact" type="button" disabled={busy||!available} onClick={start}>{busy?'Starting…':'Start my free session'}</button></>}{account&&message&&<p role="alert">{message}</p>}</aside>;
}
