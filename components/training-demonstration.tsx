'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, CircleStop, Flag, Hand, Upload } from 'lucide-react';
import { createSegmenter, summarizeHands, type Point } from '@/lib/vision/demonstration-tracking';
import { MAX_MOMENTS, MAX_TRAINING_VIDEO_BYTES } from '@/lib/training-contract';
import { captureStill } from '@/lib/training-client';

export type CapturedMoment = {id:string;frame:string;at:number;kind:'hold'|'marker';hands:number;caption:string};
export type DemonstrationResult = {file:File|null;moments:CapturedMoment[];duration:number};
type Landmarker = Awaited<ReturnType<typeof import('@/lib/vision/mediapipe').createLandmarker>>;
type Phase = 'idle'|'starting'|'recording'|'analyzing';
const MAX_SECONDS = 300;
const HAND_LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

/**
 * Records the instructor performing the skill while hand tracking runs in the
 * browser. Each time the hands work and then hold still, a still is captured
 * as a candidate step result. Nothing leaves the device until the instructor
 * saves the moments.
 */
export function DemonstrationTracker({disabled,onResult}:{disabled:boolean;onResult:(result:DemonstrationResult)=>void}) {
  const [phase,setPhase]=useState<Phase>('idle');const [tracking,setTracking]=useState<'off'|'loading'|'on'|'unavailable'>('off');
  const [hands,setHands]=useState(0);const [moving,setMoving]=useState(false);const [elapsed,setElapsed]=useState(0);const [count,setCount]=useState(0);const [message,setMessage]=useState('');
  const video=useRef<HTMLVideoElement>(null);const overlay=useRef<HTMLCanvasElement>(null);
  const stream=useRef<MediaStream|null>(null);const recorder=useRef<MediaRecorder|null>(null);const landmarker=useRef<Landmarker|null>(null);
  const loop=useRef<ReturnType<typeof setTimeout>|null>(null);const limit=useRef<ReturnType<typeof setTimeout>|null>(null);
  const started=useRef(0);const captured=useRef<CapturedMoment[]>([]);const lastHands=useRef(0);const source=useRef<'camera'|'file'>('camera');const fileUrl=useRef('');const analyzed=useRef<File|null>(null);const generation=useRef(0);
  const segmenter=useRef(createSegmenter());const phaseRef=useRef<Phase>('idle');const resultRef=useRef(onResult);resultRef.current=onResult;
  useEffect(()=>{phaseRef.current=phase;},[phase]);

  function now(){return source.current==='file'?(video.current?.currentTime??0):(performance.now()-started.current)/1000;}
  function capture(kind:CapturedMoment['kind'],at:number,handCount:number){
    const element=video.current;if(!element?.videoWidth)return;
    if(captured.current.length>=MAX_MOMENTS){setMessage(`The first ${MAX_MOMENTS} key moments are kept. Finish the demonstration, then remove any you do not need.`);return;}
    try{captured.current=[...captured.current,{id:crypto.randomUUID(),frame:captureStill(element),at:Math.round(at*10)/10,kind,hands:handCount,caption:''}];setCount(captured.current.length);}catch{setMessage('A still could not be captured from this video.');}
  }
  function draw(landmarks:Point[][]){
    const canvas=overlay.current,element=video.current;if(!canvas||!element)return;
    canvas.width=element.clientWidth;canvas.height=element.clientHeight;const context=canvas.getContext('2d');if(!context)return;
    context.clearRect(0,0,canvas.width,canvas.height);
    // The video is letterboxed inside its box; map normalized points into the visible picture.
    const scale=Math.min(canvas.width/element.videoWidth,canvas.height/element.videoHeight);const width=element.videoWidth*scale,height=element.videoHeight*scale;const left=(canvas.width-width)/2,top=(canvas.height-height)/2;
    context.lineWidth=2;context.strokeStyle='#f3b28f';context.fillStyle='#bb4827';
    for(const hand of landmarks){for(const [a,b] of HAND_LINKS){if(!hand[a]||!hand[b])continue;context.beginPath();context.moveTo(left+hand[a].x*width,top+hand[a].y*height);context.lineTo(left+hand[b].x*width,top+hand[b].y*height);context.stroke();}for(const point of hand){context.beginPath();context.arc(left+point.x*width,top+point.y*height,3,0,Math.PI*2);context.fill();}}
  }
  function track(attempt:number){
    if(attempt!==generation.current)return;
    const element=video.current;const model=landmarker.current;
    if(element&&model&&element.readyState>=2&&!element.paused){
      try{
        const frame=model.detect(element,performance.now());const summary=summarizeHands(frame.hands);const t=now();
        lastHands.current=summary.count;setHands(summary.count);draw(frame.hands);
        const event=segmenter.current.push(t,summary);setMoving(segmenter.current.state==='moving');
        if(event)capture('hold',event.at,event.hands);
      }catch{/* A dropped frame only skips one sample. */}
    }
    if(source.current==='camera')setElapsed(Math.floor(now()));
    loop.current=setTimeout(()=>track(attempt),100);
  }
  async function loadTracking(){
    if(landmarker.current){setTracking('on');return;}
    setTracking('loading');
    try{const {createLandmarker}=await import('@/lib/vision/mediapipe');landmarker.current=await createLandmarker();setTracking('on');}
    catch{setTracking('unavailable');setMessage('Hand tracking could not start in this browser. Use “Mark step” to capture each step result yourself.');}
  }
  function release(){
    generation.current++;if(loop.current)clearTimeout(loop.current);if(limit.current)clearTimeout(limit.current);
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
    if(video.current){video.current.pause();video.current.srcObject=null;video.current.removeAttribute('src');video.current.load();}
    if(fileUrl.current){URL.revokeObjectURL(fileUrl.current);fileUrl.current='';}
    overlay.current?.getContext('2d')?.clearRect(0,0,overlay.current.width,overlay.current.height);
  }
  function reset(){captured.current=[];setCount(0);setMessage('');setHands(0);setMoving(false);setElapsed(0);segmenter.current=createSegmenter();}
  function finish(file:File|null){const duration=Math.round(now()*10)/10;release();setPhase('idle');resultRef.current({file,moments:captured.current,duration});}

  async function record(){
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setMessage('Recording needs a camera-capable browser on HTTPS. You can analyze a video file instead.');return;}
    release();reset();setPhase('starting');source.current='camera';const attempt=generation.current;
    try{
      const [captured]=await Promise.all([navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:true}),loadTracking()]);
      if(attempt!==generation.current){captured.getTracks().forEach(track=>track.stop());return;}
      stream.current=captured;
      if(!video.current)throw new Error('video');
      video.current.srcObject=captured;video.current.muted=true;await video.current.play();
      const mime=['video/webm;codecs=vp9,opus','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
      const rec=new MediaRecorder(captured,mime?{mimeType:mime}:undefined);recorder.current=rec;const chunks:BlobPart[]=[];let size=0;
      rec.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>MAX_TRAINING_VIDEO_BYTES)stop();}};
      rec.onstop=()=>{const type=rec.mimeType.startsWith('video/mp4')?'video/mp4':'video/webm';finish(size>MAX_TRAINING_VIDEO_BYTES?null:new File(chunks,`demonstration.${type==='video/mp4'?'mp4':'webm'}`,{type}));if(size>MAX_TRAINING_VIDEO_BYTES)setMessage('The recording passed 100 MB, so only the key moments were kept.');};
      captured.getTracks().forEach(track=>track.addEventListener('ended',()=>stop(),{once:true}));
      started.current=performance.now();rec.start(1000);setPhase('recording');
      limit.current=setTimeout(stop,MAX_SECONDS*1000);
      track(attempt);
    }catch(error){release();setPhase('idle');setMessage(error instanceof DOMException&&error.name==='NotAllowedError'?'Camera or microphone permission was declined. You can analyze a video file instead.':'The camera could not start. Close other camera apps and try again.');}
  }
  function stop(){if(recorder.current?.state==='recording')recorder.current.stop();else if(phaseRef.current==='analyzing')finish(analyzed.current);}
  async function analyze(file:File|undefined){
    if(!file)return;
    if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)||file.size>MAX_TRAINING_VIDEO_BYTES){setMessage('Choose an MP4, WebM or MOV video up to 100 MB.');return;}
    release();reset();source.current='file';analyzed.current=file;setPhase('analyzing');const attempt=generation.current;
    await loadTracking();if(attempt!==generation.current||!video.current)return;
    fileUrl.current=URL.createObjectURL(file);const element=video.current;element.srcObject=null;element.src=fileUrl.current;element.muted=true;
    element.onended=()=>{if(attempt===generation.current)finish(file);};
    try{await element.play();track(attempt);}catch{release();setPhase('idle');setMessage('This video could not be played in the browser.');}
  }

  useEffect(()=>{
    const hidden=()=>{if(document.hidden&&(recorder.current?.state==='recording'||source.current==='file')){stop();setMessage('Tracking stopped while this page was hidden. Your key moments so far were kept.');}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{document.removeEventListener('visibilitychange',hidden);if(recorder.current?.state==='recording'){recorder.current.onstop=null;recorder.current.stop();}release();landmarker.current?.close();landmarker.current=null;};
  },[]);

  const active=phase==='recording'||phase==='analyzing';
  return <section className="training-tracker" aria-label="Demonstration tracking">
    <div className="training-tracker-stage">
      <video ref={video} playsInline muted aria-label="Demonstration being tracked"/>
      <canvas ref={overlay} aria-hidden="true"/>
      {active&&<div className="training-tracker-hud" role="status" aria-live="polite"><span><Hand size={15} aria-hidden="true"/>{tracking==='on'?`${hands} ${hands===1?'hand':'hands'} tracked`:tracking==='loading'?'Starting hand tracking…':'Hand tracking off'}</span><span>{moving?'Working…':hands?'Holding still':'Show your hands'}</span><span>{count} key {count===1?'moment':'moments'}</span>{phase==='recording'&&<span>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')} / 5:00</span>}</div>}
      {!active&&<p className="training-tracker-empty">Prop the camera so your hands and the work are visible. Perform each step, then hold the result still for a moment.</p>}
    </div>
    <div className="studio-actions">
      {phase==='recording'?<><button type="button" className="button primary compact" onClick={()=>capture('marker',now(),lastHands.current)}><Flag size={16} aria-hidden="true"/>Mark step</button><button type="button" className="button secondary compact" onClick={stop}><CircleStop size={16} aria-hidden="true"/>Finish demonstration</button></>
      :phase==='analyzing'?<><button type="button" className="button primary compact" onClick={()=>capture('marker',now(),lastHands.current)}><Flag size={16} aria-hidden="true"/>Mark step</button><button type="button" className="button secondary compact" onClick={stop}><CircleStop size={16} aria-hidden="true"/>Stop analyzing</button></>
      :<><button type="button" className="button primary compact" disabled={disabled||phase==='starting'} onClick={record}><Camera size={16} aria-hidden="true"/>{phase==='starting'?'Starting…':'Record and track demonstration'}</button><label className="button secondary compact training-file"><Upload size={16} aria-hidden="true"/>Track an existing video<input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={disabled} onChange={event=>{void analyze(event.target.files?.[0]);event.target.value='';}}/></label></>}
    </div>
    <p className="platform-small">Hand tracking runs on this device. Key moments are captured when your hands pause after working; use Mark step for anything the tracker misses. Recordings stop after five minutes. The video and stills stay on this device until you save them.</p>
    <p className="platform-message" role="status">{message}</p>
  </section>;
}
