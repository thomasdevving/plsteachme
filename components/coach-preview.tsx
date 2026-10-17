'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, RotateCcw } from 'lucide-react';
import type { Copy } from '@/lib/i18n';
import type { SkillId } from '@/lib/config';
import { modules } from '@/lib/modules';
import { LessonArtwork } from './lesson-artwork';

export function CoachPreview({ hero, skill = 'tie', name = 'Tie a tie' }: { hero: Copy['hero']; skill?: SkillId; name?: string }) {
  return <Phone key={skill} hero={hero} skill={skill} name={name}/>;
}
function Phone({ hero, skill, name }: { hero: Copy['hero']; skill: SkillId; name: string }) {
  const [step, setStep] = useState(skill === 'tie' ? 2 : 0);
  const [replay, setReplay] = useState(0);
  const lesson = modules[skill];
  const count = lesson.steps.length;
  const current = lesson.steps[step];
  return <figure id="hero-preview" className="phone-figure interactive-phone" aria-label={`${name}: coaching example`}>
    <div className="phone"><div className="phone-top"><span className="brand-mini"><span className="brand-teach">plsteach</span><span className="brand-me">.me</span></span><span className="camera-dot"/><span>9:41</span></div>
      <div className="viewfinder"><div className="camera-corner tl"/><div className="camera-corner tr"/><div className="camera-corner bl"/><div className="camera-corner br"/>
        <div className="phone-module-art"><LessonArtwork skill={skill} step={step} replay={replay}/></div>
        <div className="coach-status"><span/>{skill === 'tie' ? 'Orange: wide end · front view' : 'Illustrated step · follow at your pace'}</div>
      </div>
      <div className="phone-instruction"><div className="phone-progress" role="progressbar" aria-label="Example progress" aria-valuemin={1} aria-valuemax={count} aria-valuenow={step+1} aria-valuetext={`Step ${step+1} of ${count}`}>{lesson.steps.map((_,i)=><span key={i} className={i<=step?'complete':''}/>)}</div>
        <div key={`${skill}-${step}`} className="coach-step" aria-live="polite"><p>{name} · Step {step+1} of {count}</p><p className="phone-step-title">{current.title}</p></div>
      </div><div className="phone-home"/>
    </div>
    <div className="feedback" key={`${skill}-${step}`}><MessageCircle size={20} aria-hidden="true"/><span>{current.tip}</span></div>
    <div className="coach-controls"><button type="button" aria-label="Previous example step" disabled={step===0} onClick={()=>setStep(step-1)}><ArrowLeft size={17} aria-hidden="true"/></button><button type="button" onClick={()=>setStep(step===count-1?0:step+1)}>{step===count-1?'Try again':'Next step'}{step===count-1?<RotateCcw size={16} aria-hidden="true"/>:<ArrowRight size={16} aria-hidden="true"/>}</button><button type="button" className="motion-toggle" aria-label={skill==='tie'?'Replay this tie step':'Replay this lesson step'} onClick={()=>setReplay(value=>value+1)}><RotateCcw size={16} aria-hidden="true"/></button></div>
    <figcaption>{hero.sample} · no camera or AI feedback</figcaption>
  </figure>;
}
