'use client';
import { fetchWithTimeout } from './network';

async function trainingResponse<T>(response:Response):Promise<T> {
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.message || 'This action could not be completed. Please try again.');
  if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The service returned an incomplete response. Please try again.');
  return data as T;
}
export async function trainingFetch<T>(query:string, signal?:AbortSignal):Promise<T> {
  return trainingResponse<T>(await fetchWithTimeout(`/api/training?${query}`,{cache:'no-store',signal}));
}
export async function trainingAction<T = {ok:boolean}>(body:unknown, timeout=65000):Promise<T> {
  return trainingResponse<T>(await fetch('/api/training',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)}));
}
/** Downscaled JPEG still from a playing video, matching the server's 200 KB frame limit. */
export function captureStill(video:HTMLVideoElement, quality=.65) {
  const scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d')?.drawImage(video,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',quality);
}
