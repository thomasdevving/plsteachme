'use client';
import { useEffect, useMemo, useState } from 'react';
import { en } from '@/messages/en';
import { fetchWithTimeout } from '@/lib/network';
import type { SkillId } from '@/lib/config';

type StepRow = {step:number;learners:number;camera_confirmed:number;self_checked:number;unresolved:number;looks_right:number;adjust:number;unclear:number;not_verifiable:number;stop:number};
type LessonRow = {lessonKey:string;starts:number;completions:number;coachChecks:number;steps:StepRow[]};
type Insights = {since:string;learners:number;lessons:LessonRow[]};
const pct=(part:number,total:number)=>total?`${Math.round(part/total*100)}%`:'—';

export function InsightsDashboard(){
  const [days,setDays]=useState(30);const [data,setData]=useState<Insights|null>(null);const [state,setState]=useState<'loading'|'ready'|'signin'|'forbidden'|'error'>('loading');const [titles,setTitles]=useState<Record<string,string>>({});const [selected,setSelected]=useState('');
  useEffect(()=>{const abort=new AbortController();setState('loading');
    fetchWithTimeout(`/api/insights?days=${days}`,{cache:'no-store',signal:abort.signal}).then(async response=>{
      if(response.status===401)return setState('signin');if(response.status===403)return setState('forbidden');
      const body=await response.json().catch(()=>null);if(!response.ok||!body?.insights)return setState('error');
      setData(body.insights);setState('ready');
    }).catch(()=>{if(!abort.signal.aborted)setState('error');});
    return()=>abort.abort();},[days]);
  useEffect(()=>{fetchWithTimeout('/api/platform?view=public',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(body=>{if(body?.lessons)setTitles(Object.fromEntries(body.lessons.map((lesson:{id:string;title:string;version:number})=>[`published:${lesson.id}:v${lesson.version}`,lesson.title])));}).catch(()=>{});},[]);
  const name=(key:string)=>key.startsWith('builtin:')?en.skills.names[key.slice(8) as SkillId]||key:titles[key]||`Teacher lesson ${key.slice(10,18)}…`;
  const totals=useMemo(()=>{const lessons=data?.lessons||[];return {starts:lessons.reduce((sum,item)=>sum+item.starts,0),completions:lessons.reduce((sum,item)=>sum+item.completions,0),checks:lessons.reduce((sum,item)=>sum+item.coachChecks,0),looksRight:lessons.reduce((sum,item)=>sum+item.steps.reduce((total,step)=>total+step.looks_right,0),0)};},[data]);
  const lesson=data?.lessons.find(item=>item.lessonKey===selected)||data?.lessons[0];

  return <div className="platform-page container insights-page"><header className="platform-intro"><p className="eyebrow">Learning insights</p><h1>Is it working?</h1><p>How learners move through each lesson, where they stop, and what the camera coach decides. Counts come from anonymous browser IDs, not accounts.</p></header>
    {state==='signin'?<div className="platform-empty"><h2>Sign in to see the insights.</h2><p><a className="text-link" href="/login?next=%2Finsights">Log in</a></p></div>
    :state==='forbidden'?<div className="platform-empty"><h2>These insights are for plsteach.me staff.</h2></div>
    :state==='error'?<div className="platform-empty"><h2>The insights could not load.</h2><p>Check that the latest database migration has run, then reload.</p></div>
    :state==='loading'||!data?<p role="status">Loading insights…</p>:<>
      <div className="insights-toolbar" role="group" aria-label="Time range">{[7,30,90].map(value=><button key={value} type="button" aria-pressed={days===value} onClick={()=>setDays(value)}>Last {value} days</button>)}</div>
      <div className="training-stats"><div><strong>{data.learners}</strong><span>learners (anonymous browsers)</span></div><div><strong>{pct(totals.completions,totals.starts)}</strong><span>of started lessons completed ({totals.completions} of {totals.starts})</span></div><div><strong>{totals.checks}</strong><span>camera coach checks</span></div><div><strong>{pct(totals.looksRight,totals.checks)}</strong><span>of checks said “looks right”</span></div></div>
      {!data.lessons.length?<div className="platform-empty"><strong>No learning activity in this period yet.</strong><p>Activity appears here as learners practice lessons.</p></div>:<>
      <section className="platform-panel"><h2>Lessons</h2><div className="training-table-wrap"><table className="training-table"><caption className="sr-only">Lesson starts and completions</caption><thead><tr><th scope="col">Lesson</th><th scope="col">Started</th><th scope="col">Completed</th><th scope="col">Completion</th><th scope="col">Coach checks</th></tr></thead><tbody>{data.lessons.map(item=><tr key={item.lessonKey} aria-selected={lesson?.lessonKey===item.lessonKey}><th scope="row"><button type="button" className="text-link" onClick={()=>setSelected(item.lessonKey)}>{name(item.lessonKey)}</button></th><td>{item.starts}</td><td>{item.completions}</td><td>{pct(item.completions,item.starts)}</td><td>{item.coachChecks}</td></tr>)}</tbody></table></div></section>
      {lesson&&<LessonDetail lesson={lesson} name={name(lesson.lessonKey)}/>}</>}
      <p className="platform-small">On-device model accuracy compared with the cloud coach is in the <a className="text-link" href="/vision">vision lab</a>.</p>
    </>}
  </div>;
}

function LessonDetail({lesson,name}:{lesson:LessonRow;name:string}){
  const top=Math.max(lesson.starts,...lesson.steps.map(step=>step.learners),1);
  // The largest fall between one step and the next is where learners stop most.
  let drop={step:-1,size:0};
  lesson.steps.forEach((step,index)=>{const before=index===0?lesson.starts:lesson.steps[index-1].learners;if(before-step.learners>drop.size)drop={step:step.step,size:before-step.learners};});
  return <section className="platform-panel"><h2>{name}: step by step</h2><p>Bars show how many learners finished each step. {drop.step>=0?`Most learners stop before finishing step ${drop.step+1} (${drop.size} fewer than the step before).`:'No drop-off yet.'}</p>
    <div className="training-table-wrap"><table className="training-table insights-steps"><caption className="sr-only">Per-step completion, checkpoint results and coach verdicts for {name}</caption><thead><tr><th scope="col">Step</th><th scope="col">Learners who finished it</th><th scope="col">Camera-confirmed</th><th scope="col">Self-checked</th><th scope="col">Unresolved</th><th scope="col">Coach: looks right</th><th scope="col">Adjust</th><th scope="col">Unclear</th><th scope="col">Not verifiable</th><th scope="col">Stop</th></tr></thead>
      <tbody>{lesson.steps.map(step=>{const checks=step.looks_right+step.adjust+step.unclear+step.not_verifiable+step.stop;return <tr key={step.step} className={drop.step===step.step?'insights-drop':''}><th scope="row">{step.step+1}</th><td><span className="insights-bar" title={`${step.learners} learners finished step ${step.step+1}`}><span style={{width:`${Math.max(2,step.learners/top*100)}%`}}/></span><span className="insights-value">{step.learners}</span></td><td>{step.camera_confirmed}</td><td>{step.self_checked}</td><td>{step.unresolved}</td><td>{step.looks_right} <small>{pct(step.looks_right,checks)}</small></td><td>{step.adjust}</td><td>{step.unclear} <small>{pct(step.unclear,checks)}</small></td><td>{step.not_verifiable}</td><td>{step.stop}</td></tr>;})}</tbody></table></div>
    <p className="platform-small">Many “unclear” verdicts on a step usually mean the camera framing or the checkpoint description needs work. Camera-confirmed checkpoints are visible-evidence matches only, not proof of mastery.</p></section>;
}
