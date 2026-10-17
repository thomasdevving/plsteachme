'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from './network';

export type PlatformConfig = { available:boolean; supabaseUrl?:string|null; publishableKey?:string|null; aiAvailable?:boolean };
export const AUTH_STORAGE_KEY = 'plsteach.auth.v1';

export function createPlatformClient(config:PlatformConfig):SupabaseClient|null {
  const url=config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=config.publishableKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url || !key) return null;
  // Auth lives in the existing HTTP-only server session. This client is only
  // used to send files to server-issued signed upload destinations.
  try { return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetchWithTimeout(input,init,180_000)}}); }
  catch { return null; }
}

export async function platformFetch<T>(view:string, token?:string, signal?:AbortSignal):Promise<T> {
  return platformResponse<T>(await fetchWithTimeout(`/api/platform?${view}`,{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store',signal}));
}
export async function platformAction<T= {ok:boolean}>(body:unknown,token?:string):Promise<T> {
  return platformResponse<T>(await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)}));
}
async function platformResponse<T>(response:Response):Promise<T> {
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.message || 'This action could not be completed. Please try again.');
  if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The service returned an incomplete response. Please try again.');
  return data as T;
}
export function messageOf(error:unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
