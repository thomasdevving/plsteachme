'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, Pause, Play, RotateCcw } from 'lucide-react';
import type { Copy } from '@/lib/i18n';
import type { SkillId } from '@/lib/config';
import { modules } from '@/lib/modules';
import { SkillIcon } from './illustrations';
import { TieMotion } from './tie-motion';
const tieSteps = [
  ['Start with the wide end longer.', 'Take your time. Start where you feel comfortable.'],
  ['Cross it over the narrow end.', 'A small move. You’re getting there.'],
  ['Wrap the wide end behind.', 'Almost! Bring it a little higher.'],
  ['Bring it across the front.', 'Keep this layer flat and loose.'],
  ['Lift it through the neck loop.', 'A little space makes the next step easier.'],
  ['Pass it through the front loop.', 'Nearly there. Keep the knot relaxed.'],
  ['Slide the knot up gently.', 'One new skill. Yours to keep.']
];
export function CoachPreview({ hero, skill = 'tie', name = 'Tie a tie' }: { hero: Copy['hero']; skill?: SkillId; name?: string }) {
  const [position, setPosition] = useState({ skill, step: 2 });
  const [paused, setPaused] = useState(false);
  const figure = useRef<HTMLElement>(null);
  // Derive a fresh starting step during a skill change, without a stale frame.
  const step = position.skill === skill ? position.step : skill === 'tie' ? 2 : 0;
  const isTie = skill === 'tie';
  const lesson = modules[skill];
  const count = isTie ? tieSteps.length : lesson.steps.length;
  const instruction = isTie ? tieSteps[step][0] : lesson.steps[step];
  const feedback = isTie ? tieSteps[step][1] : lesson.tip;
  useEffect(() => {
    const node = figure.current;
    if (!node) return;
    let visible = false;
    const sync = () => node.classList.toggle('motion-active', visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);
  const move = (next: number) => setPosition({ skill, step: next });
  return <figure id="hero-preview" ref={figure} className="phone-figure interactive-phone" data-paused={paused} aria-label={`${name}: ${isTie ? 'coaching example' : 'text preview'}`}>
    <div className="phone"><div className="phone-top"><span className="brand-mini"><span className="brand-teach">plsteach</span><span className="brand-me">.me</span></span><span className="camera-dot"/><span>9:41</span></div>
      <div className={`viewfinder ${isTie ? '' : 'skill-viewfinder'}`}>
        <div className="camera-corner tl"/><div className="camera-corner tr"/><div className="camera-corner bl"/><div className="camera-corner br"/>
        <div className="phone-module-art" key={skill}>{isTie ? <TieMotion/> : <div className="phone-skill-art"><span>{lesson.category}</span><SkillIcon skill={skill} size={100}/><strong>{name}</strong></div>}</div>
        <div className="coach-status"><span/>{isTie ? 'Wrap example' : 'Text preview · coming later'}</div>
      </div>
      <div className="phone-instruction"><div className="phone-progress" role="progressbar" aria-label="Example progress" aria-valuemin={1} aria-valuemax={count} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${count}`}>{Array.from({length: count}, (_, i) => <span key={i} className={i <= step ? 'complete' : ''}/>)}</div>
        <div key={`${skill}-${step}`} className="coach-step" aria-live="polite"><p>{isTie ? '' : `${name} · `}Step {step + 1} of {count}</p><p className="phone-step-title">{instruction}</p></div>
      </div><div className="phone-home"/>
    </div>
    <div className="feedback" key={`feedback-${skill}-${step}`}><MessageCircle size={20} aria-hidden="true"/><span>{feedback}</span></div>
    <div className="coach-controls"><button type="button" aria-label="Previous example step" disabled={step === 0} onClick={() => move(step - 1)}><ArrowLeft size={17} aria-hidden="true"/></button><button type="button" onClick={() => move(step === count - 1 ? 0 : step + 1)}>{step === count - 1 ? 'Try again' : 'Next step'}{step === count - 1 ? <RotateCcw size={16} aria-hidden="true"/> : <ArrowRight size={16} aria-hidden="true"/>}</button>{isTie && <button type="button" className="motion-toggle" aria-label={paused ? 'Play tie animation' : 'Pause tie animation'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} aria-hidden="true"/> : <Pause size={16} aria-hidden="true"/>}</button>}</div>
    <figcaption>{isTie ? `${hero.sample} · sample feedback` : 'Text preview · no camera or AI feedback'}</figcaption>
  </figure>;
}
