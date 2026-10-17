'use client';
import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createPlatformClient, messageOf, platformFetch, type PlatformConfig } from '@/lib/platform-client';

type AccountContext = { loading:boolean; config:PlatformConfig|null; client:SupabaseClient|null; session:Session|null; token:()=>Promise<string|undefined> };
const Context=createContext<AccountContext>({loading:true,config:null,client:null,session:null,token:async()=>undefined});
export const usePlatformAccount=()=>useContext(Context);
export function PlatformProvider({children}:{children:ReactNode}) {
  const [config,setConfig]=useState<PlatformConfig|null>(null);
  const [client,setClient]=useState<SupabaseClient|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const abort=new AbortController(); let active=true; let unsubscribe:(()=>void)|undefined;
    platformFetch<PlatformConfig>('view=config',undefined,abort.signal).then(async value=>{
      if(!active)return;setConfig(value);
      const authClient=createPlatformClient(value);setClient(authClient);
      if(authClient){
        const {data}=authClient.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next);});
        unsubscribe=()=>data.subscription.unsubscribe();
        const {data:{session:current}}=await authClient.auth.getSession();
        if(active)setSession(current);
      }
    }).catch(()=>{if(active)setConfig({available:false});}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;abort.abort();unsubscribe?.();};
  },[]);
  const token=useCallback(async()=>{if(!client)return undefined;const {data}=await client.auth.getSession();return data.session?.access_token;},[client]);
  return <Context.Provider value={{loading,config,client,session,token}}>{children}</Context.Provider>;
}

export function PlatformAccount() {
  const {loading,config,client,session}=usePlatformAccount();
  const [email,setEmail]=useState('');const [over16,setOver16]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const id=useId();
  async function signIn(event:React.FormEvent) {
    event.preventDefault();if(!client || !over16)return;setBusy(true);setMessage('');
    try {const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:`${window.location.origin}${window.location.pathname}`}});if(error)throw error;setMessage('Check your email for a sign-in link. Open it to return here.');}
    catch(error){setMessage(messageOf(error));}finally{setBusy(false);}
  }
  async function signOut(){if(!client)return;setBusy(true);try{const {error}=await client.auth.signOut();if(error)throw error;setMessage('Signed out.');}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}}
  if(loading)return <div className="platform-account" role="status">Connecting your account...</div>;
  if(!client || !config?.available)return <aside className="platform-account platform-empty"><strong>Community accounts are not connected yet.</strong><p>You can explore the guided lessons now. Requests, teacher uploads and reviews will become available when the account service is connected.</p><a className="text-link" href="/demo">Explore lessons</a></aside>;
  return <aside className="platform-account" aria-label="Your account">{session ? <div className="platform-account-row"><p>Signed in as <strong>{session.user.email}</strong></p><button className="button secondary compact" type="button" disabled={busy} onClick={signOut}>Sign out</button></div> : <details><summary>Sign in to request a skill or contribute a lesson</summary><form className="platform-form" onSubmit={signIn}><p>We’ll email you a secure sign-in link. New accounts are created when you sign in.</p><label htmlFor={`${id}-email`}>Email address<input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label><label className="platform-check"><input type="checkbox" checked={over16} onChange={event=>setOver16(event.target.checked)}/>I am 16 or older.</label><button className="button primary compact" disabled={busy || !over16}>{busy?'Sending link...':'Email me a sign-in link'}</button><small>Your sign-in session is saved in this browser. Use Sign out on a shared device.</small></form></details>}<p className="platform-message" role="status">{message}</p></aside>;
}
