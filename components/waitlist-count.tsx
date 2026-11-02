'use client';
import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '@/lib/network';

export function WaitlistCount() {
  const [count,setCount]=useState<number|null|undefined>(undefined);
  useEffect(()=>{
    const controller=new AbortController();
    async function load() {
      try {
        const response=await fetchWithTimeout('/api/waitlist',{cache:'no-store',signal:controller.signal});
        const data=await response.json();
        if(!response.ok || !Number.isSafeInteger(data.count) || data.count<0)throw new Error('count');
        if(!controller.signal.aborted)setCount(data.count);
      } catch {if(!controller.signal.aborted)setCount(null);}
    }
    void load();
    const timer=setInterval(()=>{if(!document.hidden)void load();},60_000);
    return()=>{controller.abort();clearInterval(timer);};
  },[]);
  return <p className="waitlist-count" role="status" aria-live="polite">
    {count===undefined?'Checking the waitlist…':count===null?'The waitlist count is temporarily unavailable.':<><strong>{count.toLocaleString('en-US')}</strong> {count===1?'person':'people'} on the waitlist.</>}
  </p>;
}
