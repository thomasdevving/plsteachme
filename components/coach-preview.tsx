'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, RotateCcw } from 'lucide-react';
import type { Copy } from '@/lib/i18n';
const steps = [
  ['Start with the wide end longer.', 'Take your time. Start where you feel comfortable.'],
  ['Cross it over the narrow end.', 'A small move. You’re getting there.'],
  ['Wrap the wide end behind.', 'Almost! Bring it a little higher.'],
  ['Bring it across the front.', 'Keep this layer flat and loose.'],
  ['Lift it through the neck loop.', 'A little space makes the next step easier.'],
  ['Pass it through the front loop.', 'Nearly there. Keep the knot relaxed.'],
  ['Slide the knot up gently.', 'One new skill. Yours to keep.']
];
export function CoachPreview({ hero }: { hero: Copy['hero'] }) {
  const [step, setStep] = useState(2);
  return <figure className="phone-figure interactive-phone"><div className="phone"><div className="phone-top"><span className="brand-mini"><span className="brand-teach">plsteach</span><span className="brand-me">.me</span></span><span className="camera-dot"/><span>9:41</span></div><div className="viewfinder"><div className="camera-corner tl"/><div className="camera-corner tr"/><div className="camera-corner bl"/><div className="camera-corner br"/><img src="/tie.svg" alt="" width="420" height="340"/><div className="coach-status"><span/>Coaching example</div></div><div className="phone-instruction"><div className="phone-progress" role="progressbar" aria-label="Example progress" aria-valuemin={1} aria-valuemax={7} aria-valuenow={step+1} aria-valuetext={`Step ${step+1} of 7`}>{steps.map((_,i) => <span key={i} className={i <= step ? 'complete' : ''}/>)}</div><div key={step} className="coach-step" aria-live="polite"><p>Step {step+1} of 7</p><p className="phone-step-title">{steps[step][0]}</p></div></div><div className="phone-home"/></div><div className="feedback" key={`feedback-${step}`}><MessageCircle size={20} aria-hidden="true"/><span>{steps[step][1]}</span></div><div className="coach-controls"><button type="button" aria-label="Previous example step" disabled={step===0} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={17} aria-hidden="true"/></button><button type="button" onClick={()=>setStep(s=>s===6?0:s+1)}>{step===6?'Try again':'Next step'}{step===6?<RotateCcw size={16} aria-hidden="true"/>:<ArrowRight size={16} aria-hidden="true"/>}</button></div><figcaption>{hero.sample} · sample feedback</figcaption></figure>;
}
