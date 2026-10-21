'use client';
import { fetchWithTimeout } from '@/lib/network';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Pause, Play, RefreshCw } from 'lucide-react';
import type { SkillId } from '@/lib/config';
import { modules } from '@/lib/modules';
import { CHECK_INTERVAL_MS, feedbackSchema, framingHints, type CoachFeedback } from '@/lib/coaching-contract';
import { getCheckpoint } from '@/lib/learning-catalog';
import type { LessonDocument } from '@/lib/platform-contract';
import { ReportFeedback } from './report-feedback';
import { useLearnerTrial } from './learner-trial';
import { OnDeviceModel } from './on-device-model';
import { ObjectTracking } from './object-tracking';
import { learningSession } from '@/lib/learning-events';
import { builtinObjects, objectFromMaterials } from '@/lib/vision/objects';
import { builtinSteps, builtinTarget, lessonSteps, lessonTarget } from '@/lib/vision-contract';
import { useVoiceSession, voiceHeaders } from './voice-coach';

type Mode = 'off' | 'starting' | 'running' | 'paused';
const feedbackTitles: Record<CoachFeedback['status'],string> = {
  looks_right:'This part looks right', adjust:'Try a small adjustment', unclear:'Let’s get a clearer view',
  not_verifiable:'Use your own checkpoint', stop:'Pause and get help'
};
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve,reject)=>{
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}
function capture(video: HTMLVideoElement) {
  if (video.readyState<2 || !video.videoWidth || !video.videoHeight) throw new Error('frame');
  const scale = Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1,Math.round(video.videoWidth*scale));
  canvas.height = Math.max(1,Math.round(video.videoHeight*scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('frame');
  context.drawImage(video,0,0,canvas.width,canvas.height);
  const frame = canvas.toDataURL('image/jpeg',.65);
  canvas.width = 0; canvas.height = 0;
  return frame;
}
const cameraError = (error: unknown) => {
  const name = error instanceof Error ? error.name : '';
  if (name==='NotAllowedError' || name==='SecurityError') return 'Camera access was blocked. Allow it in your browser settings, then try again.';
  if (name==='NotFoundError') return 'No camera was found. You can keep following the illustrated lesson.';
  if (name==='NotReadableError') return 'The camera is busy. Close other camera apps, then try again.';
  return 'The camera could not start. You can try again or keep using the illustrated lesson.';
};

export function CameraCoach({ skill, step, onFeedback, onAutoAdvance, publishedLesson, organizationModule=false, holdChecks=false, checkRequest=0, onChecksActive }: {
  skill: SkillId; step: number;
  onFeedback?:(step:number,feedback:CoachFeedback)=>void;
  onAutoAdvance?:(step:number)=>void;
  /** Voice coaching is paused: automatic checks wait, whatever this panel's own state. */
  holdChecks?:boolean;
  /** Increments when the voice coach asks for a fresh check now. */
  checkRequest?:number;
  /** Whether automatic checks can currently run for this step. */
  onChecksActive?:(active:boolean)=>void;
  publishedLesson?:{id:string;version:number;document:LessonDocument};
  /** The published lesson is a private organization module; membership replaces the free trial. */
  organizationModule?:boolean;
}) {
  const trialId=useLearnerTrial();
  // Read at request time, so starting or stopping voice does not restart the checks.
  const voiceSession=useVoiceSession();
  const voice=useRef(voiceSession);voice.current=voiceSession;
  const [availability,setAvailability] = useState<'loading'|'ready'|'unavailable'|'error'>('loading');
  const [mode,setMode] = useState<Mode>('off');
  const [consent,setConsent] = useState(false);
  const [over16,setOver16] = useState(false);
  const [facing,setFacing] = useState<'user'|'environment'>(['tie','shaving','beard'].includes(skill)?'user':'environment');
  const [hidden,setHidden] = useState(false);
  const [checking,setChecking] = useState(false);
  const [feedback,setFeedback] = useState<{step:number;value:CoachFeedback}|null>(null);
  const [message,setMessage] = useState('');
  const [status,setStatus] = useState('');
  const [autoAdvance,setAutoAdvance]=useState(true);
  const [countdown,setCountdown]=useState<number|null>(null);
  const [advanceCancelled,setAdvanceCancelled]=useState(false);
  // The first camera step, “Show me the …”, comes before any step is checked.
  const [objectReady,setObjectReady]=useState(false);
  const objectReadyRef=useRef(objectReady);objectReadyRef.current=objectReady;
  const callbacks=useRef({onFeedback,onAutoAdvance});
  useEffect(()=>{callbacks.current={onFeedback,onAutoAdvance};},[onFeedback,onAutoAdvance]);
  const hasAutoAdvance=Boolean(onAutoAdvance);
  const publishedId=publishedLesson?.id;
  const publishedVersion=publishedLesson?.version;
  const currentStep=publishedLesson?.document.steps[step]??modules[skill].steps[step];
  const visionTarget=publishedLesson?lessonTarget(publishedLesson.id):builtinTarget(skill);
  const visionSteps=useMemo(()=>publishedLesson?lessonSteps(publishedLesson.document):builtinSteps(skill),[publishedLesson,skill]);
  const canVerify=publishedLesson?Boolean(currentStep && publishedLesson.document.steps[step]?.visuallyCheckable):getCheckpoint(skill,step).visuallyCheckable;
  const video = useRef<HTMLVideoElement>(null);
  const objectOverlay = useRef<HTMLCanvasElement>(null);
  const objectName = publishedLesson?objectFromMaterials(publishedLesson.document.materials):builtinObjects[skill];
  const stream = useRef<MediaStream|null>(null);
  const request = useRef<AbortController|null>(null);
  const generation = useRef(0);
  const consentId = useId();
  const ageId = useId();
  const headingId = useId();

  const releaseCamera = useCallback(()=>{
    generation.current++;
    request.current?.abort();
    stream.current?.getTracks().forEach(track=>track.stop());
    stream.current=null;
    if (video.current) video.current.srcObject=null;
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    fetchWithTimeout('/api/coaching/session',{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if (!response.ok) throw new Error('availability');
        const data=await response.json();
        if (!controller.signal.aborted) setAvailability(data.available===true?'ready':'unavailable');
      }).catch(()=>{if(!controller.signal.aborted)setAvailability('error');});
    const visibility=()=>{
      const isHidden=document.hidden;
      setHidden(isHidden);
      // Turning the camera off on a hidden page also prevents collecting frames.
      if (isHidden) { releaseCamera(); setMode('off'); setChecking(false); setStatus(''); setMessage('Camera stopped while this page was hidden. Start it again when you’re ready.'); }
    };
    const leave=()=>{releaseCamera();setMode('off');setChecking(false);setStatus('');};
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',leave);
    return ()=>{controller.abort();releaseCamera();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);};
  },[releaseCamera]);

  async function startCamera(nextFacing = facing) {
    releaseCamera();
    const current = generation.current;
    setMessage(''); setFeedback(null); setChecking(false); setMode('starting'); setStatus('Starting camera…');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera coaching needs a camera-capable browser on HTTPS or localhost.'); setMode('off'); setStatus(''); return;
    }
    try {
      const controller=new AbortController(); request.current=controller;
      // Organization modules are authorized per check by membership, not the free session.
      if (!organizationModule) {
        const response=await fetch('/api/coaching/session',{method:'POST',headers:{'Content-Type':'application/json',...(trialId?{'x-coaching-session':trialId}:{})},body:JSON.stringify({consent:true,over16:true}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        if (current!==generation.current) return;
        if (!response.ok) { setMessage(response.status===429?'Please wait ten minutes before starting another coaching session.':'Camera coaching is unavailable right now. Try again later.'); setMode('off'); setStatus(''); return; }
      }
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:nextFacing},width:{ideal:640},height:{ideal:480}}});
      if (current!==generation.current || document.hidden) {next.getTracks().forEach(track=>track.stop());return;}
      stream.current=next;
      next.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{releaseCamera();setMode('off');setChecking(false);setStatus('');setMessage('The camera disconnected. Start it again when it is available.');},{once:true}));
      if (!video.current) {releaseCamera();setMode('off');return;}
      video.current.srcObject=next;
      await video.current.play();
      if(current!==generation.current)return;
      setMode('running'); setStatus(objectReadyRef.current?'Automatic checks are starting.':`Automatic checks start after you show the ${objectName}.`);
    } catch(error) {
      if(current!==generation.current)return;
      releaseCamera();setMode('off');setStatus('');setMessage(cameraError(error));
    }
  }

  const checksActive=mode==='running' && !hidden && objectReady && !holdChecks;
  useEffect(()=>{onChecksActive?.(checksActive);},[checksActive,onChecksActive]);
  useEffect(()=>{
    if(mode!=='running' || hidden || !objectReady || holdChecks)return;
    const controller=new AbortController();
    request.current=controller;
    let failures=0;
    let checks=0;
    setFeedback(null);setChecking(false);setAdvanceCancelled(false);setStatus('Automatic checks are starting for this step.');
    async function run() {
      // The loop starts only after the camera has started and never overlaps calls.
      try {await wait(1200,controller.signal);} catch{return;}
      while(!controller.signal.aborted) {
        let delay=CHECK_INTERVAL_MS;
        try {
          if(document.hidden || !video.current || !stream.current?.active)return;
          if(video.current.readyState<2){await wait(1000,controller.signal);continue;}
          setChecking(true);setStatus('Looking at this step…');
          if(checks>=12){setMode('paused');setStatus('Automatic checks paused.');setMessage('The coach has looked several times. Reposition the camera and resume when you are ready.');return;}
          checks++;
          const first=capture(video.current);
          await wait(600,controller.signal);
          if(document.hidden || !video.current)return;
          const frames=[first,capture(video.current)];
          const response=await fetch(organizationModule?'/api/training':publishedId?'/api/platform':'/api/coaching/check',{
            method:'POST',headers:{'Content-Type':'application/json',...(trialId?{'x-coaching-session':trialId}:{}),...(learningSession()?{'x-learning-session':learningSession()!}:{}),...(organizationModule||publishedId?{}:voiceHeaders(voice.current))},
            body:JSON.stringify(organizationModule?{action:'module.coach',moduleId:publishedId,version:publishedVersion,step,frames,consent:true,over16:true}:publishedId?{action:'lesson.coach',id:publishedId,version:publishedVersion,step,frames,consent:true,over16:true}:{skill,step,frames}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)])
          });
          if(controller.signal.aborted)return;
          if(!response.ok) {
            if(response.status===429){setMode('paused');setStatus('Automatic checks paused.');setMessage('Automatic checks are paused. Wait ten minutes before resuming.');return;}
            if(response.status===401){releaseCamera();setMode('off');setChecking(false);setStatus('');setFeedback(null);setMessage('Your coaching session ended. Start camera coaching again to continue.');return;}
            if(response.status===503){releaseCamera();setMode('off');setChecking(false);setStatus('');setFeedback(null);setMessage('Camera coaching is unavailable right now. You can keep using the lesson.');return;}
            throw new Error('check');
          }
          const data=await response.json();
          if(controller.signal.aborted)return;
          if(data.step!==step || (publishedId?data.id!==publishedId||data.version!==publishedVersion:data.skill!==skill))throw new Error('stale');
          const parsed=feedbackSchema.safeParse(data.feedback);
          if(!parsed.success)throw new Error('feedback');
          let result=parsed.data;
          if(result.status!=='stop' && !canVerify)result={status:'not_verifiable',confidence:'low',observation:'This checkpoint needs your own physical or written check.',guidance:'Follow the lesson checkpoint. The camera cannot verify or automatically advance this step.'};
          else if(result.confidence!=='high' && ['looks_right','adjust'].includes(result.status))result={status:'unclear',confidence:result.confidence,observation:'There is not enough clear evidence to confirm this checkpoint.',guidance:'Show the relevant result clearly. The coach will look again automatically.'};
          failures=0;setMessage('');setFeedback({step,value:result});callbacks.current.onFeedback?.(step,result);
          if(result.status==='stop'){setMode('paused');setStatus('Automatic checks paused.');return;}
          if(['looks_right','not_verifiable'].includes(result.status)){
            setStatus(result.status==='looks_right'?'Visible checkpoint confirmed.':'Use your own checkpoint before moving on.');return;
          }
          setStatus('The coach will look again automatically.');
        } catch {
          if(controller.signal.aborted)return;
          failures++;
          if(failures>=3){setMode('paused');setStatus('Automatic checks paused.');setMessage('The coach could not respond. Checks are paused; resume when you’re ready.');return;}
          delay=CHECK_INTERVAL_MS*2**failures;
          setMessage('The coach could not respond. Retrying automatically in a moment.');
        } finally {if(!controller.signal.aborted)setChecking(false);}
        try {await wait(delay,controller.signal);}catch{return;}
      }
    }
    void run();
    return ()=>{controller.abort();};
  },[skill,step,mode,hidden,releaseCamera,publishedId,publishedVersion,canVerify,trialId,organizationModule,objectReady,holdChecks,checkRequest]);

  useEffect(()=>{
    const result=feedback?.step===step?feedback.value:null;
    if(!hasAutoAdvance || !autoAdvance || advanceCancelled || mode!=='running' || hidden || !canVerify || result?.status!=='looks_right' || result.confidence!=='high') {setCountdown(null);return;}
    let remaining=4;setCountdown(remaining);
    const timer=setInterval(()=>{
      if(document.hidden){clearInterval(timer);setCountdown(null);return;}
      remaining--;
      if(remaining===0){clearInterval(timer);setCountdown(null);callbacks.current.onAutoAdvance?.(step);}
      else setCountdown(remaining);
    },1000);
    return ()=>clearInterval(timer);
  },[feedback,step,autoAdvance,advanceCancelled,mode,hidden,canVerify,hasAutoAdvance]);

  function stop() {
    releaseCamera();setMode('off');setFeedback(null);setChecking(false);setStatus('');setMessage('Camera stopped. No more frames are being sent.');
    void fetch('/api/coaching/session',{method:'DELETE',keepalive:true}).catch(()=>{});
  }
  const currentFeedback=feedback?.step===step?feedback.value:null;
  const active=mode!=='off';
  return <section className="camera-coach" aria-labelledby={headingId}>
    <h4 id={headingId}><Camera size={20} aria-hidden="true"/>Camera coach</h4>
    <p className="camera-intro">Get feedback automatically as you practice. Clear visual checkpoints can move you forward after a short countdown.</p>
    {onAutoAdvance && <label className="camera-auto-advance"><input type="checkbox" checked={autoAdvance} onChange={event=>setAutoAdvance(event.target.checked)}/>Automatically advance camera-confirmed checkpoints</label>}
    {!active && <>
      {availability==='loading' && <p role="status">Checking coaching availability…</p>}
      {availability==='unavailable' && <p className="camera-notice">Camera coaching isn’t connected yet. You can still follow every illustrated lesson.</p>}
      {availability==='error' && <p className="camera-notice">Coaching availability could not be checked. Reload this page to try again.</p>}
      {availability==='ready' && <div className="camera-consent">
        <p>While coaching is active, pairs of still images go to OpenAI automatically, usually several seconds apart. Live video stays on your device. This app does not save images; OpenAI’s retention rules apply. <a href="/privacy">Read the privacy details</a>.</p>
        <label htmlFor={ageId}><input id={ageId} type="checkbox" checked={over16} onChange={event=>setOver16(event.target.checked)}/>I am 16 or older.</label>
        <label htmlFor={consentId}><input id={consentId} type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>I agree to automatic image checks while camera coaching is active.</label>
      </div>}
      <button type="button" className="button secondary compact" disabled={availability!=='ready'||!consent||!over16||hidden} onClick={()=>{setObjectReady(false);void startCamera();}}><Camera size={17} aria-hidden="true"/>Start camera coaching</button>
    </>}
    {active && (objectReady?<p className="camera-current-step"><strong>Step {step+1}: {currentStep.title}</strong><br/>{currentStep.check}</p>:<p className="camera-current-step"><strong>Before step {step+1}: show me the {objectName}</strong><br/>The coach learns what your {objectName} looks like, then follows it while you practice.</p>)}
    <div className="camera-preview" hidden={!active}><video ref={video} autoPlay muted playsInline aria-label="Your live camera preview" className={facing==='user'?'mirrored':undefined}/><canvas ref={objectOverlay} className="camera-object-overlay" aria-hidden="true"/><span className="camera-indicator">{mode==='paused'||holdChecks&&mode==='running'?'Checks paused':mode==='starting'?'Starting camera':'Camera on · automatic checks'}</span></div>
    <ObjectTracking objectName={objectName} video={video} overlay={objectOverlay} active={mode==='running'||mode==='paused'} mirrored={facing==='user'} onReady={()=>setObjectReady(true)}/>
    {!organizationModule && <OnDeviceModel target={visionTarget} steps={visionSteps} step={step} video={video} running={mode==='running'&&!hidden} feedback={feedback}/>}
    {active && <>
      <p className="camera-framing">{publishedLesson?'Show the tools and result for this checkpoint. Never hold the camera while using tools.':framingHints[skill]}</p>
      {holdChecks && mode==='running' && <p className="camera-limit" role="status">Automatic checks are paused with voice coaching.</p>}
      <p className="camera-limit">Still images are sent to OpenAI automatically while checks run. <a href="/privacy">Privacy details</a>.</p>
      <div className="camera-controls">
        {mode==='running' && <button type="button" className="button secondary compact" onClick={()=>{request.current?.abort();setMode('paused');setChecking(false);setStatus('Automatic checks paused.');}}><Pause size={16} aria-hidden="true"/>Pause coaching</button>}
        {mode==='paused' && <button type="button" className="button secondary compact" onClick={()=>{setMessage('');setFeedback(null);setMode('running');}}><Play size={16} aria-hidden="true"/>Resume coaching</button>}
        {mode!=='starting' && <button type="button" className="button secondary compact" onClick={()=>{const next=facing==='user'?'environment':'user';setFacing(next);void startCamera(next);}}><RefreshCw size={16} aria-hidden="true"/>Switch camera</button>}
        <button type="button" className="button secondary compact" onClick={stop}><CameraOff size={16} aria-hidden="true"/>Stop camera</button>
      </div>
    </>}
    <div className="camera-feedback" role="status" aria-live="polite" aria-atomic="true" aria-busy={checking}>
      {currentFeedback && <><strong>{feedbackTitles[currentFeedback.status]}</strong><p>{currentFeedback.observation}</p><p>{currentFeedback.guidance}</p></>}
      {status && <small>{status}</small>}{message && <p>{message}</p>}
    </div>
    {countdown!==null && <div className="camera-countdown" role="status"><p>Visible checkpoint confirmed. Moving to the next step in {countdown}…</p><button type="button" className="button secondary compact" onClick={()=>{setAdvanceCancelled(true);setCountdown(null);}}>Stay on this step</button></div>}
    {advanceCancelled && currentFeedback?.status==='looks_right' && <p className="camera-limit">Automatic advancement cancelled for this step. Continue when you’re ready.</p>}
    {currentFeedback && !organizationModule && <ReportFeedback skill={skill} step={step} feedback={currentFeedback} publishedLesson={publishedLesson?{id:publishedLesson.id,version:publishedLesson.version}:undefined} onOpen={()=>{request.current?.abort();setMode('paused');setChecking(false);setStatus('Automatic checks paused while you report this feedback.');}}/>}
    <p className="camera-limit">AI feedback can be wrong. Use the written checkpoints and tool instructions, especially around sharp tools, heat and moving parts.</p>
  </section>;
}
