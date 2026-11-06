'use client';
import { extractFeatures } from './features';
import type { LandmarkFrame } from './prechecks';

type Landmarker = Awaited<ReturnType<typeof import('./mediapipe').createLandmarker>>;
let shared: Promise<Landmarker> | null = null;
/** One MediaPipe instance per page; the models are several megabytes. */
export function loadLandmarker() {
  shared ??= import('./mediapipe').then(({ createLandmarker }) => createLandmarker()).catch((error) => { shared = null; throw error; });
  return shared;
}

type Subscriber={onFrame:(features:number[],frame:LandmarkFrame)=>void;onError?:()=>void;interval:number;last:number};
type Loop={subscribers:Set<Subscriber>;stop:()=>void;start:()=>void;failed:boolean};
const loops=new WeakMap<HTMLVideoElement,Loop>();
/** One inference per video frame, shared by the visible skeleton and shadow model. */
export function startLandmarkLoop(video:HTMLVideoElement,onFrame:Subscriber['onFrame'],intervalMs=100,onError?:()=>void) {
 let loop=loops.get(video);
 if(!loop){
  const subscribers=new Set<Subscriber>();let stopped=false,lastVideoTime=-1,timer:ReturnType<typeof setTimeout>|null=null;
  loop={subscribers,failed:false,stop:()=>{stopped=true;if(timer)clearTimeout(timer);},start:()=>{}};loops.set(video,loop);
  const current=loop;
  current.start=()=>{current.failed=false;void loadLandmarker().then(landmarker=>{
   const tick=()=>{
    if(stopped)return;
    const now=performance.now(),due=[...subscribers].filter(item=>now-item.last>=item.interval);
    const fresh=!Number.isFinite(video.currentTime)||video.currentTime!==lastVideoTime;
    if(due.length&&fresh&&video.readyState>=2&&!video.paused&&video.videoWidth){
     try {const frame=landmarker.detect(video,now),features=extractFeatures(frame);lastVideoTime=video.currentTime;for(const item of due){item.last=now;try{item.onFrame(features,frame);}catch{/* One subscriber cannot stop the others. */}}}catch{/* A dropped frame is retried without inventing landmarks. */}
    }
    timer=setTimeout(tick,Math.max(40,Math.min(...[...subscribers].map(item=>item.interval))));
   };tick();
  }).catch(()=>{if(!stopped){current.failed=true;for(const item of subscribers)item.onError?.();}});};current.start();
 }
 const current=loop,subscriber:Subscriber={onFrame,onError,interval:Math.max(40,intervalMs),last:-Infinity};current.subscribers.add(subscriber);if(current.failed)current.start();
 return()=>{current.subscribers.delete(subscriber);if(!current.subscribers.size){current.stop();loops.delete(video);}};
}
