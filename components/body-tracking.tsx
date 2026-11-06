'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { startLandmarkLoop } from '@/lib/vision/landmark-loop';
import { visibleBody } from '@/lib/vision/body-overlay';
import { previewGeometry, previewPoint } from '@/lib/vision/camera-preview';
export function BodyTracking({video,overlay,active,mirrored}:{video:RefObject<HTMLVideoElement|null>;overlay:RefObject<HTMLCanvasElement|null>;active:boolean;mirrored:boolean}) {
 const [message,setMessage]=useState('Starting body tracking…'),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const mirror=useRef(mirrored);mirror.current=mirrored;
 useEffect(()=>{
  const element=video.current,canvas=overlay.current;if(!active||!element||!canvas)return;
  let stopped=false,loadFailed=false,last='',lastFrame=performance.now();loadFailed=false;setFailed(false);setMessage('Starting body tracking…');
  function clear(){const ctx=canvas!.getContext('2d');ctx?.setTransform(1,0,0,1,0,0);ctx?.clearRect(0,0,canvas!.width,canvas!.height);}
  const stop=startLandmarkLoop(element,(_features,frame)=>{
   if(stopped)return;lastFrame=performance.now();loadFailed=false;setFailed(false);
   const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
   if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
   const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
   const body=visibleBody(frame),geometry=previewGeometry(element.videoWidth,element.videoHeight,width,height);
   ctx.lineWidth=3;ctx.strokeStyle='#faf7f2';ctx.fillStyle='#bb4827';
   for(const line of body.lines){const a=previewPoint(line.from.x,line.from.y,geometry,mirror.current),b=previewPoint(line.to.x,line.to.y,geometry,mirror.current);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();for(const point of [a,b]){ctx.beginPath();ctx.arc(point.x,point.y,4,0,Math.PI*2);ctx.fill();}}
   const next=frame.ambiguous?'Keep just one person in view.':body.ready?'Body joints visible. You can move naturally.':'Step back until your shoulders, hips and knees are visible.';
   if(last!==next){last=next;setMessage(next);}
  },120,()=>{if(!stopped){loadFailed=true;clear();setFailed(true);setMessage('Body tracking could not load. You can retry or keep using the written lesson.');}});
  // Never leave a stale skeleton on a stalled/hidden camera image.
  const stale=setInterval(()=>{if(!loadFailed&&performance.now()-lastFrame>1500){clear();if(!last.includes('not updating')){last='Camera view is not updating. Check your camera and keep your body in view.';setMessage(last);}}},500);
  return()=>{stopped=true;stop();clearInterval(stale);clear();};
 },[active,retry,video,overlay]);
 if(!active)return null;
 return <div className="body-tracking"><p role="status" aria-live="polite">{message}</p>{failed&&<button type="button" className="text-link" onClick={()=>setRetry(value=>value+1)}>Retry body tracking</button>}<small className="camera-limit">Joint lines follow your body on this device. They do not verify a complete movement or certify your technique.</small></div>;
}
