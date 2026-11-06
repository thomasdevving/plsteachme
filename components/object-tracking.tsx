'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ANALYSIS_WIDTH, enroll, initialState, track, clampBox, type Box, type Frame, type ObjectModel, type TrackState } from '@/lib/vision/object-tracker';
import { trackingFocus, type FocusBox } from '@/lib/vision/coaching-focus';
import { captureCameraFrame, objectGuide, objectOutlines, previewGeometry, previewPoint } from '@/lib/vision/camera-preview';
import { scanMotion, scanQuality } from '@/lib/vision/scan-stability';
import type { GuidedObject } from '@/lib/vision/camera-guidance';
import type { ObjectScanResult } from '@/lib/vision/object-scan-contract';

type Phase='positioning'|'checking'|'tracking'|'blocked';
export function ObjectTracking({kind,video,overlay,active,mirrored,onReady,onReset,onFocus,recognize}:{kind:GuidedObject;video:RefObject<HTMLVideoElement|null>;overlay:RefObject<HTMLCanvasElement|null>;active:boolean;mirrored:boolean;onReady:()=>void;onReset:()=>void;onFocus?:(box:FocusBox|null)=>void;recognize:(frames:string[],guide:FocusBox,signal:AbortSignal)=>Promise<ObjectScanResult>}) {
 const [phase,setPhase]=useState<Phase>('positioning'),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 const model=useRef<ObjectModel|null>(null),state=useRef<TrackState>(initialState()),work=useRef<HTMLCanvasElement|null>(null);
 const callbacks=useRef({onReady,onReset,onFocus,recognize});callbacks.current={onReady,onReset,onFocus,recognize};
 const mirror=useRef(mirrored);mirror.current=mirrored;
 useEffect(()=>{
  if(!active){callbacks.current.onFocus?.(null);overlay.current?.getContext('2d')?.clearRect(0,0,overlay.current.width,overlay.current.height);return;}
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|null=null,stopped=false;
  let previous:Frame|null=null,stableSince=0,lastAttempt=-Infinity,attempts=0,blocked=false,lastStatus='';
  const guide=objectGuide(kind);
  const say=(message:string)=>{if(message!==lastStatus){lastStatus=message;setStatus(message);}};
  const grab=():Frame|null=>{
   const element=video.current;if(!element||element.readyState<2||!element.videoWidth)return null;
   work.current??=document.createElement('canvas');const canvas=work.current;const height=Math.round(ANALYSIS_WIDTH*element.videoHeight/element.videoWidth);if(canvas.width!==ANALYSIS_WIDTH||canvas.height!==height){canvas.width=ANALYSIS_WIDTH;canvas.height=height;}
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
   ctx.drawImage(element,0,0,canvas.width,canvas.height);return ctx.getImageData(0,0,canvas.width,canvas.height);
  };
  const draw=(box:FocusBox,label:string,outline:boolean,checking=false,uncertain=false)=>{
   const element=video.current,canvas=overlay.current;if(!element?.videoWidth||!canvas)return;
   const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);
   if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
   const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
   const geometry=previewGeometry(element.videoWidth,element.videoHeight,width,height);
   ctx.beginPath();
   if(outline){objectOutlines[kind].forEach(([x,y],i)=>{const p=previewPoint(box.x+x*box.w,box.y+y*box.h,geometry,mirror.current);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();}
   else {const p=previewPoint(mirror.current?box.x+box.w:box.x,box.y,geometry,mirror.current);ctx.rect(p.x,p.y,box.w*geometry.width,box.h*geometry.height);}
   ctx.setLineDash(outline||uncertain?[8,5]:[]);ctx.lineWidth=5;ctx.strokeStyle='#22372c99';ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=checking?'#f3aa75':outline||uncertain?'#faf7f2':'#f08a5d';ctx.stroke();ctx.setLineDash([]);
   ctx.font='600 13px sans-serif';ctx.fillStyle='#22372c';ctx.fillRect(8,8,Math.min(width-16,ctx.measureText(label).width+20),27);ctx.fillStyle='#faf7f2';ctx.fillText(label,18,26,width-36);
  };
  const pixelBox=(frame:Frame,box=guide):Box=>({x:box.x*frame.width,y:box.y*frame.height,w:box.w*frame.width,h:box.h*frame.height});
  const later=()=>{if(!stopped)timer=setTimeout(()=>void tick(),140);};
  const tick=async()=>{
   if(stopped)return;
   const frame=grab();if(!frame){later();return;}
   if(model.current){
    state.current=track(frame,model.current,state.current);callbacks.current.onFocus?.(trackingFocus(state.current,frame));
    const current=state.current;
    const box=current.box?{x:current.box.x/frame.width,y:current.box.y/frame.height,w:current.box.w/frame.width,h:current.box.h/frame.height}:guide;
    draw(box,current.status==='tracking'?`${kind} · appearance match`:`Looking for the ${kind}…`,!current.box,false,current.status!=='tracking');
    say(current.status==='tracking'?`Tracking the ${kind}’s appearance.`:`Rechecking the ${kind}. Coaching still uses the whole camera view.`);later();return;
   }
   callbacks.current.onFocus?.(null);draw(guide,`Position the ${kind} here`,true);
   if(blocked){later();return;}
   const now=performance.now(),area=pixelBox(frame);
   if(!scanQuality(frame,area)){stableSince=0;previous=frame;say('Improve the lighting and show the object clearly.');later();return;}
   if(!previous||scanMotion(previous,frame,area)>.075){stableSince=now;previous=frame;say(`Place the ${kind} roughly inside the outline and hold it steady for a moment.`);later();return;}
   previous=frame;if(!stableSince)stableSince=now;
   if(now-stableSince<650||now-lastAttempt<7000){later();return;}
   if(attempts>=6){blocked=true;setPhase('blocked');say('No clear match yet. Adjust your view and try recognition again.');later();return;}
   attempts++;lastAttempt=now;setPhase('checking');draw(guide,`Checking the ${kind}…`,true,true);say(`Checking whether your ${kind} is visible…`);
   try {
    const first=frame,firstImage=captureCameraFrame(video.current!);
    await new Promise<void>(resolve=>{const done=()=>{clearTimeout(t);controller.signal.removeEventListener('abort',done);resolve();};const t=setTimeout(done,300);controller.signal.addEventListener('abort',done,{once:true});});
    if(stopped)return;
    const second=grab();if(!second||scanMotion(first,second,area)>.10){stableSince=0;setPhase('positioning');later();return;}
    const result=await callbacks.current.recognize([firstImage,captureCameraFrame(video.current!)],guide,controller.signal);
    if(stopped)return;
    const current=grab();
    if(result.recognized&&result.box&&current&&scanMotion(second,current,area)<.12){
     const raw=pixelBox(second,result.box),box=clampBox({x:raw.x-raw.w*.12,y:raw.y-raw.h*.12,w:raw.w*1.24,h:raw.h*1.24},second);
     model.current=enroll([first,second],box);state.current={box,score:1,status:'tracking',misses:0};
     setPhase('tracking');say(`${kind==='tie'?'Tie':'Razor'} recognized. Your lesson can start.`);callbacks.current.onReady();
    } else {setPhase('positioning');stableSince=0;say(result.recognized?'The object moved while checking. Show it inside the outline again.':result.guidance);}
   } catch {if(!stopped){blocked=true;setPhase('blocked');say('Object recognition could not complete. Check your connection and try again.');}}
   later();
  };
  if(model.current){setPhase('tracking');callbacks.current.onReady();}
  else{setPhase('positioning');callbacks.current.onReset();say(`Place the ${kind} roughly inside the outline. The lesson starts only after recognition.`);}
  void tick();
  return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer);callbacks.current.onFocus?.(null);const canvas=overlay.current;if(canvas){const ctx=canvas.getContext('2d');ctx?.setTransform(1,0,0,1,0,0);ctx?.clearRect(0,0,canvas.width,canvas.height);}};
 },[active,kind,retry,video,overlay]);
 if(!active)return null;
 function again(){model.current=null;state.current=initialState();callbacks.current.onReset();setRetry(value=>value+1);}
 return <div className="object-tracking" data-phase={phase}>
  {phase!=='tracking'&&<p className="object-tracking-step"><strong>Position your {kind}</strong><br/>Use the outline as a guide; different shapes and colours are fine. {kind==='razor'?'Keep it away from your skin while positioning. ':''}We start when the object is recognized, not after a countdown.</p>}
  <p className="object-tracking-status" role="status" aria-live="polite">{status}</p>
  <div className="object-tracking-actions">{phase==='blocked'&&<button type="button" className="text-link" onClick={again}>Try recognition again</button>}{phase==='tracking'&&<button type="button" className="text-link" onClick={again}>Position the {kind} again</button>}</div>
  <small className="camera-limit">Recognition checks complete camera images. After setup, the box is a local tracking hint; coaching keeps using the whole view.</small>
 </div>;
}
