'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ANALYSIS_WIDTH, enroll, initialState, track, type Box, type Frame, type ObjectModel, type TrackState } from '@/lib/vision/object-tracker';

type Phase = 'waiting' | 'countdown' | 'capturing' | 'tracking' | 'skipped';
const VIEWS = 5;
const COUNTDOWN = 4;

/**
 * The first camera step of a lesson: “Show me the razor”. It starts on its
 * own when the camera starts. The learner holds the object in the guide box,
 * or drags a box around it on the preview at any moment. A few views are
 * learned, then the object is tracked on the preview. Runs entirely on the device.
 */
export function ObjectTracking({objectName,video,overlay,active,mirrored,onReady}:{objectName:string;video:RefObject<HTMLVideoElement|null>;overlay:RefObject<HTMLCanvasElement|null>;active:boolean;mirrored:boolean;onReady:()=>void}){
  const [phase,setPhase]=useState<Phase>('waiting');const [status,setStatus]=useState('');const [redraw,setRedraw]=useState(false);
  const model=useRef<ObjectModel|null>(null);const state=useRef<TrackState>(initialState());const canvas=useRef<HTMLCanvasElement|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const generation=useRef(0);const drag=useRef<{x:number;y:number}|null>(null);const drawn=useRef<Box|null>(null);
  const mirror=useRef(mirrored);mirror.current=mirrored;const ready=useRef(onReady);ready.current=onReady;
  const Name=objectName.charAt(0).toUpperCase()+objectName.slice(1);

  const grab=useCallback(():Frame|null=>{
    const element=video.current;if(!element||element.readyState<2||!element.videoWidth)return null;
    const height=Math.round(ANALYSIS_WIDTH*element.videoHeight/element.videoWidth);
    canvas.current??=document.createElement('canvas');const work=canvas.current;
    if(work.width!==ANALYSIS_WIDTH||work.height!==height){work.width=ANALYSIS_WIDTH;work.height=height;}
    const context=work.getContext('2d',{willReadFrequently:true});if(!context)return null;
    context.drawImage(element,0,0,ANALYSIS_WIDTH,height);
    return context.getImageData(0,0,ANALYSIS_WIDTH,height);
  },[video]);
  /** Maps analysis-frame boxes to the letterboxed, possibly mirrored preview. */
  const geometry=useCallback(()=>{
    const element=video.current,target=overlay.current;if(!element||!target||!element.videoWidth)return null;
    const width=target.clientWidth,height=target.clientHeight;
    if(target.width!==width||target.height!==height){target.width=width;target.height=height;}
    const scale=Math.min(width/element.videoWidth,height/element.videoHeight);const shownW=element.videoWidth*scale,shownH=element.videoHeight*scale;
    const frameH=ANALYSIS_WIDTH*element.videoHeight/element.videoWidth;
    return {target,left:(width-shownW)/2,top:(height-shownH)/2,sx:shownW/ANALYSIS_WIDTH,sy:shownH/frameH,frameH};
  },[video,overlay]);
  const clear=useCallback(()=>{const target=overlay.current;target?.getContext('2d')?.clearRect(0,0,target.width,target.height);},[overlay]);
  const draw=useCallback((box:Box|null,label:string,style:'track'|'guide'|'search')=>{
    const g=geometry();if(!g)return;const context=g.target.getContext('2d');if(!context)return;
    context.clearRect(0,0,g.target.width,g.target.height);
    context.font='600 13px system-ui, sans-serif';context.lineWidth=3;
    if(!box||style==='search'){context.fillStyle='#17261fcc';const width=context.measureText(label).width+20;context.fillRect(10,10,width,28);context.fillStyle='#f7f5ee';context.fillText(label,20,29);return;}
    const x=g.left+(mirror.current?ANALYSIS_WIDTH-box.x-box.w:box.x)*g.sx,y=g.top+box.y*g.sy,w=box.w*g.sx,h=box.h*g.sy;
    context.strokeStyle=style==='guide'?'#f7f5ee':'#f08a5d';context.setLineDash(style==='guide'?[8,6]:[]);
    context.strokeRect(x,y,w,h);context.setLineDash([]);
    const width=context.measureText(label).width+16;const labelY=y>30?y-26:y+h+4;
    context.fillStyle=style==='guide'?'#17261fcc':'#bb4827';context.fillRect(x-1.5,labelY,width,22);
    context.fillStyle='#fff';context.fillText(label,x+6.5,labelY+15);
  },[geometry]);
  const guideBox=useCallback(():Box|null=>{const g=geometry();if(!g)return null;const w=ANALYSIS_WIDTH*.34,h=g.frameH*.46;return {x:(ANALYSIS_WIDTH-w)/2,y:(g.frameH-h)/2,w,h};},[geometry]);
  const stopLoop=useCallback(()=>{generation.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);

  const runTracking=useCallback(()=>{
    stopLoop();const attempt=generation.current;let last:TrackState['status']|null=null;
    const tick=()=>{
      if(attempt!==generation.current||!model.current)return;
      const frame=grab();
      if(frame){
        state.current=track(frame,model.current,state.current);const current=state.current;
        if(current.status==='tracking'&&current.box)draw(current.box,`${Name} · ${Math.round(Math.min(1,current.score)*100)}% match`,'track');
        else draw(null,`Looking for the ${objectName}…`,'search');
        if(current.status!==last){last=current.status;setStatus(current.status==='tracking'?`Tracking the ${objectName}.`:`The ${objectName} is out of view. Show it again to resume tracking.`);}
      }
      timer.current=setTimeout(tick,80);
    };
    tick();
  },[draw,grab,stopLoop,Name,objectName]);

  // Few-shot enrollment: several views a moment apart while the learner turns the object.
  const capture=useCallback((box:Box)=>{
    stopLoop();const attempt=generation.current;const views:Frame[]=[];setPhase('capturing');setRedraw(false);setStatus(`Slowly turn the ${objectName} a little.`);
    const take=()=>{
      if(attempt!==generation.current)return;
      const frame=grab();if(frame)views.push(frame);
      draw(box,`Learning your ${objectName} · ${views.length}/${VIEWS}`,'guide');
      if(views.length<VIEWS){timer.current=setTimeout(take,300);return;}
      model.current=enroll(views,box);state.current={box,score:1,status:'tracking',misses:0};
      setPhase('tracking');setStatus(`Got it. Tracking the ${objectName}.`);runTracking();ready.current();
    };
    take();
  },[draw,grab,runTracking,stopLoop,objectName]);
  const countdown=useCallback(()=>{
    stopLoop();const attempt=generation.current;let remaining=COUNTDOWN;setPhase('countdown');
    setStatus(`Hold the ${objectName} inside the box, or drag a box around it on your preview.`);
    const tick=()=>{
      if(attempt!==generation.current)return;
      const box=guideBox();
      if(!box){timer.current=setTimeout(tick,200);return;}
      if(remaining===0){capture(box);return;}
      draw(box,`Hold the ${objectName} here · ${remaining}`,'guide');
      remaining--;timer.current=setTimeout(tick,1000);
    };
    tick();
  },[capture,draw,guideBox,stopLoop,objectName]);
  function skip(){stopLoop();clear();setPhase('skipped');setStatus(`Skipped. The coach checks your steps without following the ${objectName}.`);ready.current();}
  function again(){model.current=null;state.current=initialState();setRedraw(false);countdown();}

  // The step starts by itself with the camera; an object learned earlier is reused.
  useEffect(()=>{
    if(!active){stopLoop();clear();return;}
    if(model.current){state.current=initialState();setPhase('tracking');runTracking();ready.current();}
    else if(phase==='skipped')ready.current();
    else countdown();
  },[active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>()=>stopLoop(),[stopLoop]);

  // Dragging a box on the preview: any moment during the step, or later after “Draw a new box”.
  const drawing=active&&(phase==='countdown'||redraw);
  useEffect(()=>{
    const target=overlay.current;if(!target||!drawing)return;
    const point=(event:PointerEvent)=>{const g=geometry();if(!g)return null;const rect=g.target.getBoundingClientRect();const sx=(event.clientX-rect.left-g.left)/g.sx,sy=(event.clientY-rect.top-g.top)/g.sy;return {x:mirror.current?ANALYSIS_WIDTH-sx:sx,y:sy};};
    const down=(event:PointerEvent)=>{stopLoop();drag.current=point(event);target.setPointerCapture(event.pointerId);setStatus(`Drag around the ${objectName}, then let go.`);};
    const move=(event:PointerEvent)=>{const start=drag.current,end=point(event);if(!start||!end)return;drawn.current={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};draw(drawn.current,`Your ${objectName}`,'guide');};
    const up=()=>{const box=drawn.current;drag.current=null;drawn.current=null;if(box&&box.w>=6&&box.h>=6)capture(box);else{setStatus(`That box was too small. Drag a box around the whole ${objectName}.`);if(phase==='countdown')countdown();}};
    target.addEventListener('pointerdown',down);target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);
    return()=>{target.removeEventListener('pointerdown',down);target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',up);};
  },[drawing,phase,overlay,capture,countdown,draw,geometry,stopLoop,objectName]);
  useEffect(()=>{overlay.current?.classList.toggle('drawing',drawing);overlay.current?.setAttribute('data-tracking',phase==='tracking'?state.current.status:phase);},[drawing,phase,overlay,status]);

  if(!active)return null;
  const inStep=phase==='countdown'||phase==='capturing';
  return <div className="object-tracking">
    {inStep&&<p className="object-tracking-step"><strong>Show me the {objectName}</strong><br/>Hold it inside the box on your preview and turn it slowly, or drag a box around it. Your lesson steps start right after.</p>}
    <p className="object-tracking-status" role="status" aria-live="polite">{status}</p>
    <div className="object-tracking-actions">
      {inStep&&<button type="button" className="text-link" onClick={skip}>Skip this step</button>}
      {phase==='tracking'&&!redraw&&<><button type="button" className="text-link" onClick={()=>{stopLoop();clear();setRedraw(true);setStatus(`Drag a box around the ${objectName} on your preview.`);}}>Draw a new box</button><button type="button" className="text-link" onClick={again}>Show the {objectName} again</button></>}
      {redraw&&phase==='tracking'&&<button type="button" className="text-link" onClick={()=>{setRedraw(false);runTracking();}}>Cancel</button>}
      {phase==='skipped'&&<button type="button" className="text-link" onClick={again}>Show me the {objectName} after all</button>}
    </div>
    <small className="camera-limit">Object tracking runs on your device. It shows where the {objectName} is; it does not judge your technique yet.</small>
  </div>;
}
