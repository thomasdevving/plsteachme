'use client';
import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import type { Copy } from '@/lib/i18n';
import type { SkillId } from '@/lib/config';
import { SkillIcon } from './illustrations';
import { CoachPreview } from './coach-preview';
import { Cta } from './utilities';
const heroSkills: SkillId[] = ['tie', 'shaving', 'button', 'ironing', 'cooking', 'bike'];
export function Hero({ c }: { c: Pick<Copy, 'hero' | 'skills'> }) {
  const [skill, setSkill] = useState<SkillId>('tie');
  return <section className="hero"><div className="container hero-grid">
    <div className="hero-copy">
      <p className="hero-eyebrow">{c.hero.eyebrow}</p>
      <h1>{c.hero.title.split('\n').map((line, i) => <span key={line} className={i === 1 ? 'hero-emphasis' : undefined}>{line}{i === 0 ? ' ' : ''}</span>)}</h1>
      <p className="hero-sub">{c.hero.sub}</p>
      <div className="hero-actions"><Cta href="#waitlist" kind="waitlist">{c.hero.primary}</Cta><Cta href="#demo" kind="demo" secondary>{c.hero.secondary}</Cta></div>
      <div className="hero-modules">
        <p id="hero-modules-label">Pick a skill. Try a step.<a href="#skills" aria-label="All 9 modules">All 9<ArrowRight size={14} aria-hidden="true"/></a></p>
        <div className="hero-module-options" role="group" aria-labelledby="hero-modules-label">
          {heroSkills.map(id => <button key={id} type="button" aria-pressed={skill === id} aria-controls="hero-preview" onClick={() => setSkill(id)}><SkillIcon skill={id} size={23}/><span>{c.skills.names[id]}</span>{skill === id && <Check className="hero-module-check" size={13} aria-hidden="true"/>}</button>)}
        </div>
      </div>
    </div>
    <div className="hero-visual"><CoachPreview hero={c.hero} skill={skill} name={c.skills.names[skill]}/></div>
  </div></section>;
}
