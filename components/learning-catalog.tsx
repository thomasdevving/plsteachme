'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { skillIds, type SkillId } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { modules } from '@/lib/modules';
import { catalogEntries, learningJourneys, realLifeCategories, type RealLifeCategory } from '@/lib/learning-catalog';
import { PROGRESS_EVENT, PROGRESS_KEY, progressSummary, readProgress, type LearningProgress } from '@/lib/learning-progress';
import { SkillIcon } from './illustrations';
import { LessonPlayer } from './lesson-player';

export function LearningCatalog({names}:{names:Copy['skills']['names']}) {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState<RealLifeCategory|'All skills'>('All skills');
  const [selected,setSelected]=useState<SkillId|null>(null);
  const [progress,setProgress]=useState<LearningProgress>({version:1,lessons:{}});
  const player=useRef<HTMLDivElement>(null);
  const searchId=useId();
  const playerId=useId();
  useEffect(()=>{
    const refresh=()=>setProgress(readProgress());
    const storage=(event:StorageEvent)=>{if(event.key===PROGRESS_KEY || event.key===null)refresh();};
    const fromUrl=()=>{const candidate=new URL(window.location.href).searchParams.get('skill');setSelected(!new URL(window.location.href).searchParams.has('lesson')&&skillIds.includes(candidate as SkillId)?candidate as SkillId:null);};
    refresh();fromUrl();window.addEventListener(PROGRESS_EVENT,refresh);window.addEventListener('storage',storage);window.addEventListener('popstate',fromUrl);
    return ()=>{window.removeEventListener(PROGRESS_EVENT,refresh);window.removeEventListener('storage',storage);window.removeEventListener('popstate',fromUrl);};
  },[]);
  function choose(skill:SkillId) {
    setSelected(skill);const url=new URL(window.location.href);url.searchParams.set('skill',skill);url.searchParams.delete('lesson');window.history.replaceState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'));
    requestAnimationFrame(()=>{player.current?.focus({preventScroll:true});player.current?.scrollIntoView({behavior:'instant',block:'start'});});
  }
  const search=query.trim().toLocaleLowerCase();
  const filtered=skillIds.filter(skill=>(category==='All skills'||catalogEntries[skill].categories.includes(category)) && (!search||`${names[skill]} ${modules[skill].intro} ${catalogEntries[skill].keywords} ${catalogEntries[skill].categories.join(' ')}`.toLocaleLowerCase().includes(search)));
  const inProgress=skillIds.filter(skill=>progress.lessons[skill]&&!progress.lessons[skill]?.completed).sort((a,b)=>(progress.lessons[b]?.updatedAt??0)-(progress.lessons[a]?.updatedAt??0));
  return <div className="learning-catalog">
    {inProgress.length>0 && <section className="continue-learning" aria-label="Continue learning"><h2>Pick up where you left off</h2><div>{inProgress.map(skill=><button type="button" key={skill} onClick={()=>choose(skill)}>Resume {names[skill]}<span>Step {(progress.lessons[skill]?.step??0)+1} of 7</span><ArrowRight size={18} aria-hidden="true"/></button>)}</div></section>}
    <section className="learning-discovery" aria-labelledby="catalog-title"><h2 id="catalog-title">Find your next useful skill.</h2><p>Nine illustrated lessons. Start with a small task and build from there.</p><div className="catalog-search"><label htmlFor={searchId}>Search skills</label><div><Search size={20} aria-hidden="true"/><input id={searchId} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Try laundry, interview or sewing"/></div></div><div className="catalog-categories" role="group" aria-label="Filter by real-life category">{(['All skills',...realLifeCategories] as const).map(item=><button key={item} type="button" aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div><p className="catalog-results" role="status">{filtered.length} {filtered.length===1?'skill':'skills'} found</p><div className="catalog-grid">{filtered.map(skill=>{const saved=progress.lessons[skill];const summary=saved?progressSummary(saved):null;return <article className="catalog-card" key={skill}><SkillIcon skill={skill} size={34}/><p className="lesson-eyebrow">{catalogEntries[skill].categories[0]}</p><h3>{names[skill]}</h3><p>{modules[skill].intro}</p><small>7 steps · illustrated walkthrough</small>{summary && <p className="catalog-saved">{saved?.completed?'Walkthrough complete':'Practice started'} · {summary.camera} camera-confirmed · {summary.self} self-checked · {summary.unresolved} unresolved</p>}<button type="button" className="button secondary compact" aria-controls={playerId} onClick={()=>choose(skill)}>{saved?.completed?'Review':saved?'Resume':'Start'} {names[skill]}<ArrowRight size={17} aria-hidden="true"/></button></article>;})}</div>{filtered.length===0 && <div className="catalog-empty"><p>No matching lesson yet. Try a different search or tell us what you want to learn.</p><a className="button secondary compact" href="/community">Request a skill</a></div>}</section>
    <div id={playerId} ref={player} tabIndex={-1} className="catalog-player">{selected && <LessonPlayer skill={selected} name={names[selected]}/>}</div>
    <section className="learning-journeys" aria-labelledby="journeys-title"><h2 id="journeys-title">A few skills that fit together.</h2><p>Choose a learning journey for the moment you’re in.</p><div>{learningJourneys.map(journey=><article key={journey.id}><BookOpen size={22} aria-hidden="true"/><h3>{journey.title}</h3><p>{journey.description}</p><ol>{journey.skills.map(skill=><li key={skill}><button type="button" onClick={()=>choose(skill)}>{names[skill]}{progress.lessons[skill]?.completed && <span>Walkthrough complete</span>}<ArrowRight size={15} aria-hidden="true"/></button></li>)}</ol></article>)}</div></section>
  </div>;
}
