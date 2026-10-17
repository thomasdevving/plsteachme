'use client';
import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { modules } from '@/lib/modules';
import { skillIds, type SkillId } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { SkillIcon } from './illustrations';
import { LessonArtwork } from './lesson-artwork';

export function LessonPlayer({ skill, name }: { skill: SkillId; name: string }) {
  return <Player key={skill} skill={skill} name={name}/>;
}

function Player({ skill, name }: { skill: SkillId; name: string }) {
  const lesson = modules[skill];
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  const [completed, setCompleted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const current = lesson.steps[step];
  function move(next: number) {
    setCompleted(false); setStep(next);
    requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
  }
  function finish() {
    setCompleted(true);
    requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));
  }
  return <section className="lesson-player" aria-labelledby={titleId} data-skill={skill}>
    <div className="lesson-overview"><p className="lesson-eyebrow">{lesson.category} · {lesson.steps.length} guided steps</p><h3 id={titleId}>{name}</h3><p>{lesson.intro}</p><details className="lesson-materials"><summary>What you’ll need</summary><ul>{lesson.materials.map(item=><li key={item}>{item}</li>)}</ul></details><small>Illustrated walkthrough · no camera or AI feedback</small></div>
    <div className="lesson-workspace"><div className="lesson-art"><LessonArtwork skill={skill} step={step} replay={replay}/><button type="button" className="lesson-replay motion-toggle" aria-label="Replay this lesson step" onClick={()=>setReplay(value=>value+1)}><RotateCcw size={17} aria-hidden="true"/>Replay</button></div>
      <div className="lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={completed ? lesson.steps.length : step} aria-valuetext={completed ? 'Walkthrough complete' : `Step ${step+1} of ${lesson.steps.length}`}>{lesson.steps.map((_,i)=><span key={i} className={completed || i<step ? 'complete' : i===step ? 'current' : ''}/>)}</div>
      <div className="lesson-copy" aria-live="polite">{completed ? <><span className="lesson-step">Walkthrough complete</span><h4 ref={heading} tabIndex={-1}>One more skill to practice.</h4><p>{lesson.outcome}</p><p className="lesson-completion-note">You moved through all {lesson.steps.length} steps. This is your own practice check, without automatic verification.</p></> : <><span className="lesson-step">Step {step+1} of {lesson.steps.length}</span><h4 ref={heading} tabIndex={-1}>{current.title}</h4><p>{current.instruction}</p><p className="lesson-tip">{current.tip}</p><p className="lesson-check"><Check size={18} aria-hidden="true"/><span>Before moving on: {current.check}</span></p></>}</div>
      <div className="lesson-controls"><button type="button" className="button secondary compact" disabled={step===0 && !completed} onClick={()=>move(completed ? lesson.steps.length-1 : step-1)} aria-label="Previous lesson step"><ArrowLeft size={17} aria-hidden="true"/>Back</button>{completed ? <button type="button" className="button primary compact" onClick={()=>move(0)}><RotateCcw size={17} aria-hidden="true"/>Practice again</button> : <button type="button" className="button primary compact" onClick={()=>step===lesson.steps.length-1 ? finish() : move(step+1)}>{step===lesson.steps.length-1 ? 'Finish walkthrough' : 'Next lesson step'}<ArrowRight size={17} aria-hidden="true"/></button>}</div>
    </div>
  </section>;
}

export function LessonLibrary({ names }: { names: Copy['skills']['names'] }) {
  const [skill,setSkill] = useState<SkillId>('tie');
  const id = useId();
  return <div className="lesson-library"><div className="hero-module-options" role="group" aria-label="Choose a lesson">{skillIds.map(item=><button type="button" key={item} aria-pressed={skill===item} aria-controls={id} onClick={()=>setSkill(item)}><SkillIcon skill={item} size={23}/><span>{names[item]}</span>{skill===item && <Check size={14} aria-hidden="true"/>}</button>)}</div><div id={id}><LessonPlayer skill={skill} name={names[skill]}/></div></div>;
}
