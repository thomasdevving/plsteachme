'use client';
import { fetchWithTimeout } from '@/lib/network';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPlatformClient, messageOf, platformFetch, type PlatformConfig } from '@/lib/platform-client';

type AccountSession={user:{id:string;email?:string}};
type AccountContext={loading:boolean;config:PlatformConfig|null;client:SupabaseClient|null;session:AccountSession|null;token:()=>Promise<undefined>};
const noToken=async()=>undefined;
const Context=createContext<AccountContext>({loading:true,config:null,client:null,session:null,token:noToken});
export const usePlatformAccount=()=>useContext(Context);
export function PlatformProvider({children}:{children:ReactNode}) {
 const [config,setConfig]=useState<PlatformConfig|null>(null),[client,setClient]=useState<SupabaseClient|null>(null),[session,setSession]=useState<AccountSession|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{const abort=new AbortController();let active=true;
  Promise.all([platformFetch<PlatformConfig>('view=config',undefined,abort.signal),fetchWithTimeout('/api/auth/session',{cache:'no-store',signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error('account');return response.json();})]).then(([value,account])=>{if(!active)return;setConfig(value);setClient(createPlatformClient(value));setSession(account.user?{user:account.user}:null);}).catch(()=>{if(active)setConfig({available:false});}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;abort.abort();};
 },[]);
 return <Context.Provider value={{loading,config,client,session,token:noToken}}>{children}</Context.Provider>;
}
export function PlatformAccount(){
 const {loading,config,session}=usePlatformAccount();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function signOut(){setBusy(true);try{const response=await fetchWithTimeout('/api/auth/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signout'})});if(!response.ok)throw new Error('Could not sign out. Please try again.');window.location.assign('/login');}catch(error){setMessage(messageOf(error));setBusy(false);}}
 if(loading)return <div className="platform-account" role="status">Connecting your account...</div>;
 if(!config?.available)return <aside className="platform-account platform-empty"><strong>Community accounts are not connected yet.</strong><p>You can explore the guided lessons now. Requests, teacher uploads and reviews will become available when the account service is connected.</p><a className="text-link" href="/learn">Explore lessons</a></aside>;
 const next=typeof window==='undefined'?'/community':window.location.pathname+window.location.search;
 return <aside className="platform-account" aria-label="Your account">{session?<div className="platform-account-row"><p>Signed in as <strong>{session.user.email}</strong></p><a className="text-link" href="/account">Your account</a><button className="button secondary compact" type="button" disabled={busy} onClick={signOut}>Sign out</button></div>:<><strong>Use your plsteach.me account</strong><p>Sign in to request a skill or contribute a lesson. Your account and free coaching session work across the app.</p><div className="session-buttons"><a className="button primary compact" href={`/login?next=${encodeURIComponent(next)}`}>Log in</a><a className="button secondary compact" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</a></div></>}<p className="platform-message" role="status">{message}</p></aside>;
}
