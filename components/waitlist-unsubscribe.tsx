'use client';
import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '@/lib/network';
export function WaitlistUnsubscribe() {
  const [proof,setProof]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[removed,setRemoved]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const value=new URLSearchParams(location.hash.slice(1)).get('token')||'';
    setProof(value.length===80?value:'');
    // The email link keeps its proof out of request URLs/referrer headers.
  },[]);
  async function remove() {
    if(!proof)return;setBusy(true);setMessage('');
    try {
      const response=await fetchWithTimeout('/api/waitlist/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:proof})});
      if(!response.ok)throw new Error();
      setRemoved(true);history.replaceState(null,'',location.pathname);
    } catch {setMessage('We could not process the removal. Please try again.');} finally {setBusy(false);}
  }
  return <div className="thanks-content unsubscribe-content">
    <h1>{removed?'You’re off the list.':'Leave the waitlist?'}</h1>
    {removed?<><p>Your waitlist entry has been removed. We won’t send further waitlist updates for this entry.</p><a className="text-link" href="/">Back to plsteach.me</a></>:<>
      <p>Didn’t sign up, or changed your mind? Remove your email from the plsteach.me waitlist. This also removes any skill suggestion linked to that entry.</p>
      {proof===null?<p role="status">Checking the link…</p>:proof?<button className="button primary" onClick={remove} disabled={busy}>{busy?'Removing…':'Remove me from the waitlist'}</button>:<p>Open the removal link in your confirmation email. If you need help, email <a href="mailto:contact@plsteach.me">contact@plsteach.me</a>.</p>}
      {message&&<p role="alert">{message}</p>}
    </>}
  </div>;
}
