"use client";

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { SkillId } from '@/lib/config';
import { SkillIcon } from './illustrations';

type ModuleEntry = {
  id: SkillId; title: string; description: string; category: string; steps: number; href: string;
};

export function ModuleLibrary({ entries }: { entries: ModuleEntry[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All modules');
  const categories = ['All modules', ...new Set(entries.map(entry => entry.category))];
  const filtered = entries.filter(entry =>
    (category === 'All modules' || entry.category === category) &&
    `${entry.title} ${entry.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return <section id="modules" className="coach-module-library" aria-label="Module library">
    <div className="coach-module-tools">
      <div className="module-filters" role="group" aria-label="Filter modules by category">
        {categories.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}
      </div>
      <div className="module-search">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="module-search">Search modules</label>
        <input id="module-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a skill…" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17} aria-hidden="true" /></button>}
      </div>
    </div>
    <p className="module-results" role="status">{filtered.length} {filtered.length === 1 ? 'module' : 'modules'}{category !== 'All modules' ? ` · ${category}` : ''}{query.trim() ? ` matching “${query.trim()}”` : ''}</p>
    <ul className="module-grid">
      {filtered.map(entry => <li className="module-item" key={entry.id}>
        <Link href={entry.href} className="module-link" aria-labelledby={`module-${entry.id}-title`}>
          <div className="module-art" data-category={entry.category} aria-hidden="true">
            <span className="module-category-label">{entry.category}</span>
            <SkillIcon skill={entry.id} size={92} />
            <span className="module-card-arrow"><ArrowUpRight size={22} /></span>
          </div>
          <div className="module-copy">
            <h2 id={`module-${entry.id}-title`}>{entry.title}</h2>
            <p>{entry.description}</p>
            <span className="module-action"><span>{entry.steps} steps</span><span>Open module <ArrowUpRight size={17} aria-hidden="true" /></span></span>
          </div>
        </Link>
      </li>)}
    </ul>
    {!filtered.length && <div className="module-empty">
      <h2>No modules found.</h2>
      <p>Try a different skill or clear your filters.</p>
      <button className="button secondary" type="button" onClick={() => { setQuery(''); setCategory('All modules'); }}>Show all modules</button>
    </div>}
  </section>;
}
