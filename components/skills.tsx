'use client';
import { useRef, useState } from 'react';
import { Check, ArrowUpRight, ArrowRight, X } from 'lucide-react';
import { skillIds, pathFor, type Locale, type SkillId } from '@/lib/config';
import { categories, modules, type Category } from '@/lib/modules';
import type { Copy } from '@/lib/i18n';
import { track } from '@/lib/analytics';
import { SkillIcon } from './illustrations';
import { LessonPlayer } from './lesson-player';
export function Skills({ c, locale }: { c: Pick<Copy,'skills'|'form'|'demo'>; locale: Locale }) {
  const [voted, setVoted] = useState<SkillId[]>([]);
  const [pending, setPending] = useState<SkillId | null>(null);
  const [gate, setGate] = useState<SkillId | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<Category>('All skills');
  const [selected, setSelected] = useState<SkillId | null>(null);

  const preview = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const visible = skillIds.filter(skill => category === 'All skills' || modules[skill].category === category);
  async function vote(skill: SkillId) {
    setPending(skill); setMessage(''); setGate(null);
    try { const res = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skill, over16: true, website: '' }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error === 'rate' ? c.form.rate : c.form.error); if (data.mock) setMessage(c.form.mockSuccess); setVoted(v => [...v,skill]); track('skill_vote', { skill }); } catch (error) { setMessage(error instanceof Error ? error.message : c.form.error); } finally { setPending(null); }
  }
  function explore(skill: SkillId, button: HTMLButtonElement) {
    opener.current = button; setSelected(skill);
    requestAnimationFrame(() => { preview.current?.focus({preventScroll:true}); preview.current?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); });
  }
  return <><div className="module-toolbar"><div className="module-filters" role="group" aria-label="Filter learning modules">{categories.map(item => <button key={item} type="button" aria-pressed={category===item} onClick={()=>{setCategory(item);setSelected(null);setGate(null);}}>{item}<span>{item==='All skills'?skillIds.length:skillIds.filter(id=>modules[id].category===item).length}</span></button>)}</div><p className="module-count" role="status">{visible.length} modules to explore</p></div><div className="skill-grid" key={category}>{visible.map((skill,index) => <article style={{'--module-index':index%3} as React.CSSProperties} className={`skill-card ${skill === 'tie' ? 'featured' : ''}`} key={skill}><div className="skill-art"><SkillIcon skill={skill}/><span className="module-category">{modules[skill].category}</span></div><div className="skill-info"><span className="status-pill">{c.skills.available}</span><h3>{c.skills.names[skill]}</h3><p>{c.skills.descriptions[skill]}</p><button type="button" className="module-explore text-link" aria-label={`Explore lesson: ${c.skills.names[skill]}`} aria-expanded={selected===skill} aria-controls={selected === skill ? 'module-preview' : undefined} onClick={event=>explore(skill,event.currentTarget)}>Explore lesson<ArrowRight size={16} aria-hidden="true"/></button>{skill === 'tie' ? <a href={pathFor(locale,'demo')} className="text-link module-demo" onClick={() => track('cta_demo_click')}>{c.demo.try}<ArrowUpRight size={17} aria-hidden="true"/></a> : <button type="button" className="vote-button" disabled={voted.includes(skill) || pending !== null} onClick={() => ageConfirmed ? vote(skill) : setGate(skill)}>{voted.includes(skill) ? <><Check size={17} aria-hidden="true"/>{c.skills.voted}</> : pending === skill ? c.skills.pending : <>{c.skills.vote}<span aria-hidden="true">+</span></>}</button>}</div></article>)}</div>
  {selected && <div id="module-preview" className="module-preview module-lesson" ref={preview} tabIndex={-1} role="region" aria-label={`${c.skills.names[selected]} lesson`}><LessonPlayer skill={selected} name={c.skills.names[selected]}/><button type="button" className="preview-close" aria-label="Close module lesson" onClick={()=>{setSelected(null);opener.current?.focus({preventScroll:true});}}><X size={20} aria-hidden="true"/></button></div>}
  {gate && <div className="vote-gate"><p>{c.skills.ageGate}</p><button className="button primary compact" onClick={() => { setAgeConfirmed(true); vote(gate); }}>{c.skills.yes16}</button><button className="button secondary compact" onClick={() => { setGate(null); setMessage(c.skills.ageNote); }}>{c.skills.no16}</button></div>}<p className="form-message" role="status">{message}</p></>;
}
