'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Check, Search, X } from 'lucide-react';
import { skillIds, type SkillId } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { modules } from '@/lib/modules';
import { catalogEntries, learningJourneys, realLifeCategories, type RealLifeCategory } from '@/lib/learning-catalog';
import { PROGRESS_EVENT, PROGRESS_KEY, progressSummary, readProgress, type LearningProgress, type LessonProgress } from '@/lib/learning-progress';
import { SkillIcon } from './illustrations';
import { LessonPlayer } from './lesson-player';

function CheckpointTrack({ saved }: { saved: LessonProgress }) {
  return <span className="catalog-checkpoints" aria-hidden="true">
    {saved.checkpoints.map((state, index) => <span key={index} data-state={state} />)}
  </span>;
}

export function LearningCatalog({ names }: { names: Copy['skills']['names'] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RealLifeCategory | 'All skills'>('All skills');
  const [selected, setSelected] = useState<SkillId | null>(null);
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [progress, setProgress] = useState<LearningProgress>({ version: 1, lessons: {} });
  const player = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const playerId = useId();

  useEffect(() => {
    const refresh = () => setProgress(readProgress());
    const storage = (event: StorageEvent) => { if (event.key === PROGRESS_KEY || event.key === null) refresh(); };
    const fromUrl = () => {
      const params = new URL(window.location.href).searchParams;
      const candidate = params.get('skill');
      const next = !params.has('lesson') && skillIds.includes(candidate as SkillId) ? candidate as SkillId : null;
      setSelected(next);
      if (next) setSelectionRequest(request => request + 1);
    };
    refresh();
    fromUrl();
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener('storage', storage);
    window.addEventListener('popstate', fromUrl);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('popstate', fromUrl);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      const params = new URL(window.location.href).searchParams;
      if (params.has('lesson') || params.get('skill') !== selected) return;
      player.current?.focus({ preventScroll: true });
      player.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, selectionRequest]);

  function choose(skill: SkillId) {
    const url = new URL(window.location.href);
    url.searchParams.set('skill', skill);
    url.searchParams.delete('lesson');
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  const search = query.trim().toLocaleLowerCase();
  const filtered = skillIds.filter(skill =>
    (category === 'All skills' || catalogEntries[skill].categories.includes(category)) &&
    (!search || `${names[skill]} ${modules[skill].intro} ${catalogEntries[skill].keywords} ${catalogEntries[skill].categories.join(' ')}`.toLocaleLowerCase().includes(search)),
  );
  const inProgress = skillIds
    .filter(skill => progress.lessons[skill] && !progress.lessons[skill]?.completed)
    .sort((a, b) => (progress.lessons[b]?.updatedAt ?? 0) - (progress.lessons[a]?.updatedAt ?? 0));

  return <div className="learning-catalog">
    {inProgress.length > 0 ? <section className="continue-learning" aria-label="Continue learning">
      <header className="catalog-section-heading">
        <div><h2>Pick up where you left off</h2></div>
        <p>Progress is saved in this browser.</p>
      </header>
      <div className="catalog-resume-grid">{inProgress.map(skill => {
        const saved = progress.lessons[skill]!;
        return <button type="button" key={skill} className="catalog-resume-card" aria-controls={playerId} onClick={() => choose(skill)}>
          <span className="catalog-resume-art" data-skill={skill}><SkillIcon skill={skill} size={42} /></span>
          <span className="catalog-resume-copy"><strong>Resume {names[skill]}</strong><span>Step {saved.step + 1} of {modules[skill].steps.length}</span><CheckpointTrack saved={saved} /></span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>;
      })}</div>
    </section> : null}

    <section className="learning-discovery" aria-labelledby="catalog-title">
      <header className="catalog-masthead">
        <div><h1 id="catalog-title">Find your next<br /><em>useful skill.</em></h1><p>Practice with clear steps, automatic camera checks and room to try again. Start with a small task and build from there.</p></div>
        <div className="catalog-edition"><span aria-hidden="true">{String(skillIds.length).padStart(2, '0')}</span><p><span className="sr-only">{skillIds.length} </span>practical skills</p></div>
      </header>

      <div className="catalog-discovery-tools">
        <div className="catalog-search"><label htmlFor={searchId}>Search skills</label><div><Search size={21} aria-hidden="true" /><input ref={searchInput} id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try laundry, interview or sewing" />{query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={18} aria-hidden="true" /></button> : null}</div></div>
        <div className="catalog-categories" role="group" aria-label="Filter by real-life category">
          {(['All skills', ...realLifeCategories] as const).map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}<span aria-hidden="true">{item === 'All skills' ? skillIds.length : skillIds.filter(skill => catalogEntries[skill].categories.includes(item)).length}</span></button>)}
        </div>
      </div>

      <div className="catalog-results-row"><p className="catalog-results" role="status">{filtered.length} {filtered.length === 1 ? 'skill' : 'skills'} found</p></div>
      <div className="catalog-grid">{filtered.map(skill => {
        const saved = progress.lessons[skill];
        const summary = saved ? progressSummary(saved) : null;
        const steps = modules[skill].steps.length;
        return <article className="catalog-card" key={skill} data-selected={selected === skill}>
          <div className="catalog-card-art" data-skill={skill}>
            <span className="catalog-card-number" aria-hidden="true">{String(skillIds.indexOf(skill) + 1).padStart(2, '0')}</span>
            <span className="catalog-step-count">{steps} steps</span>
            <span className="catalog-icon-stage"><SkillIcon skill={skill} size={110} /></span>
          </div>
          <div className="catalog-card-copy">
            <p className="lesson-eyebrow">{catalogEntries[skill].categories[0]}</p>
            <h3>{names[skill]}</h3>
            <p>{modules[skill].intro}</p>
            <small>Illustrated walkthrough</small>
            {saved && summary ? <div className="catalog-progress-note"><CheckpointTrack saved={saved} /><p className="catalog-saved">{saved.completed ? 'Walkthrough complete' : 'Practice started'} · {summary.camera} camera-confirmed · {summary.self} self-checked · {summary.unresolved} unresolved</p></div> : null}
            <button type="button" className="button secondary compact" aria-controls={playerId} onClick={() => choose(skill)}>{saved?.completed ? 'Review' : saved ? 'Resume' : 'Start'} {names[skill]}<ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        </article>;
      })}</div>
      {filtered.length === 0 ? <div className="catalog-empty"><Search size={32} aria-hidden="true" /><h3>There’s more to learn.</h3><p>No matching lesson yet. Try a different search or tell us what you want to learn.</p><a className="button secondary compact" href="/community">Request a skill<ArrowRight size={17} aria-hidden="true" /></a></div> : null}
    </section>

    <div id={playerId} ref={player} tabIndex={-1} className="catalog-player">{selected ? <LessonPlayer skill={selected} name={names[selected]} /> : null}</div>

    <section className="learning-journeys" aria-labelledby="journeys-title">
      <header className="catalog-section-heading"><div><p className="catalog-kicker">Learning journeys</p><h2 id="journeys-title">A few skills that fit together.</h2></div><p>Choose a group of related skills.</p></header>
      <div className="catalog-journey-grid">{learningJourneys.map((journey, journeyIndex) => {
        const completed = journey.skills.filter(skill => progress.lessons[skill]?.completed).length;
        return <article key={journey.id} className="catalog-journey-card">
          <div className="catalog-journey-top"><span className="catalog-journey-number">Journey {String(journeyIndex + 1).padStart(2, '0')}</span><div className="catalog-journey-icons" aria-hidden="true">{journey.skills.map(skill => <span key={skill} data-skill={skill}><SkillIcon skill={skill} size={25} /></span>)}</div></div>
          <h3>{journey.title}</h3><p>{journey.description}</p>
          <ol>{journey.skills.map((skill, index) => <li key={skill}><button type="button" aria-controls={playerId} onClick={() => choose(skill)}><span className="catalog-journey-step" aria-hidden="true">{progress.lessons[skill]?.completed ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span><span className="catalog-journey-skill">{names[skill]}</span>{progress.lessons[skill]?.completed ? <span className="catalog-journey-complete">Walkthrough complete</span> : null}<ArrowRight size={16} aria-hidden="true" /></button></li>)}</ol>
          <div className="catalog-journey-footer"><span>{completed > 0 ? `${completed} of ${journey.skills.length} walkthroughs complete` : `${journey.skills.length} skills · begin anywhere`}</span><span className="catalog-journey-meter" aria-hidden="true">{journey.skills.map(skill => <span key={skill} data-complete={Boolean(progress.lessons[skill]?.completed)} />)}</span></div>
        </article>;
      })}</div>
    </section>
  </div>;
}
