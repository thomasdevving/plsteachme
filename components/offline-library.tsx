'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Trash2, WifiOff } from 'lucide-react';
import { skillIds, type SkillId } from '@/lib/config';
import { modules } from '@/lib/modules';
import { en } from '@/messages/en';
import { builtinLessonHref } from '@/lib/lesson-navigation';
import { PROGRESS_EVENT, progressSummary, readProgress, type LearningProgress } from '@/lib/learning-progress';
import { useConnectivity } from '@/lib/offline/connectivity';
import { formatBytes, removeAllLessons, useOfflineLessons } from '@/lib/offline/store';
import { SkillIcon } from './illustrations';
import { OfflineBadge, OfflineLessonControl } from './offline-lesson';
import { InstallAppPanel } from './install-app';
import { DownloadMascot } from './download-mascot';

const names = en.skills.names;

/** Why the learner landed here: the service worker adds ?from= when a page needed the network. */
function arrivalNotice(from: string | null, online: boolean) {
  if (!from) return null;
  const lesson = /^\/learn\/([a-z]+)$/.exec(from)?.[1];
  if (lesson && skillIds.includes(lesson as SkillId)) return `${names[lesson as SkillId]} isn’t downloaded on this device, so it needs an internet connection.`;
  if (/^\/learn(?:\/lessons\/|\/?$)/.test(from)) return from.startsWith('/learn/lessons/') ? 'Reviewed lessons need an internet connection.' : null;
  if (/^\/(?:account|login|signup|forgot-password|reset-password)(?:\/|$)/.test(from)) return 'Your account, sign-in and password links need an internet connection. Downloaded lessons work without one.';
  if (/^\/training(?:\/|$)/.test(from)) return 'Organization training needs an internet connection.';
  return online ? 'That page couldn’t be loaded just now. Downloaded lessons still work.' : 'That page needs an internet connection. Downloaded lessons still work.';
}

function LessonProgressNote({ skill, progress }: { skill: SkillId; progress: LearningProgress }) {
  const saved = progress.lessons[skill];
  if (!saved) return <span>Not started</span>;
  const summary = progressSummary(saved);
  return <span>{saved.completed ? 'Walkthrough complete' : `Step ${saved.step + 1} of ${modules[skill].steps.length}`} · {summary.self} self-checked · {summary.camera} camera-confirmed · {summary.unresolved} unresolved</span>;
}

export function OfflineLibrary() {
  const offline = useOfflineLessons();
  const connection = useConnectivity();
  const [from, setFrom] = useState<string | null>(null);
  const [progress, setProgress] = useState<LearningProgress>({ version: 1, lessons: {} });
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setFrom(new URLSearchParams(window.location.search).get('from'));
    const refresh = () => setProgress(readProgress());
    refresh();
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(PROGRESS_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const downloaded = skillIds.filter((skill) => offline.packages[skill]);
  const others = skillIds.filter((skill) => !offline.packages[skill]);
  const total = Object.values(offline.packages).reduce((sum, item) => sum + (item?.info.bytes ?? 0), 0);
  const notice = arrivalNotice(from, connection.online);
  // Lessons open with a full page load so the service worker can serve the downloaded copy.
  return <div className="container offline-library">
    <header className="offline-masthead">
      <div className="offline-title-row">
        <div><p className="offline-kicker">Offline lessons</p><h1>Practice without <em>internet.</em></h1></div>
        <DownloadMascot />
      </div>
      <p>Download built-in lessons to this device. The illustrated steps, materials, safety notes and checkpoints then work offline, and your progress is saved here. Camera coaching, questions and your account need a connection.</p>
    </header>
    {notice && <p className="offline-arrival" role="status"><WifiOff size={17} aria-hidden="true" />{notice}</p>}
    {connection.online && from && <p className="offline-meta"><a className="text-link" href="/learn">Back to all lessons<ArrowRight size={16} aria-hidden="true" /></a></p>}

    <section className="offline-section" aria-labelledby="offline-ready-title">
      <header className="catalog-section-heading"><div><h2 id="offline-ready-title">Ready on this device</h2></div>{offline.ready && offline.supported && <p>{downloaded.length ? `${downloaded.length} ${downloaded.length === 1 ? 'lesson' : 'lessons'} · ${formatBytes(total)} on this device` : 'No lessons downloaded yet'}</p>}</header>
      {!offline.ready ? <p role="status">Checking downloads on this device…</p>
        : !offline.supported ? <p>This browser can’t keep lessons for offline use. You can keep learning online.</p>
        : downloaded.length === 0 ? <p className="offline-empty">{connection.online ? 'Choose a lesson below and select Download for offline.' : 'Nothing is downloaded on this device yet. Connect to the internet to download lessons.'}</p>
        : <ul className="offline-list">{downloaded.map((skill) => <li key={skill} className="offline-row">
          <span className="offline-row-art" data-skill={skill}><SkillIcon skill={skill} size={34} /></span>
          <div className="offline-row-copy">
            <h3>{names[skill]}</h3>
            <p><LessonProgressNote skill={skill} progress={progress} /></p>
            <OfflineLessonControl skill={skill} name={names[skill]} heading={false} />
          </div>
          <a className="button primary compact" href={builtinLessonHref(skill)}>{progress.lessons[skill] && !progress.lessons[skill]?.completed ? 'Resume' : 'Open'}<span className="sr-only"> {names[skill]}</span><ArrowRight size={17} aria-hidden="true" /></a>
        </li>)}</ul>}
    </section>

    {offline.supported && others.length > 0 && <section className="offline-section" aria-labelledby="offline-more-title">
      <header className="catalog-section-heading"><div><h2 id="offline-more-title">{connection.online ? 'Download more lessons' : 'Needs an internet connection'}</h2></div><p>{connection.online ? 'Each lesson is a few megabytes. Videos and camera models are never downloaded.' : 'These lessons open again when you’re back online.'}</p></header>
      <ul className="offline-list">{others.map((skill) => <li key={skill} className="offline-row" data-available={connection.online}>
        <span className="offline-row-art" data-skill={skill}><SkillIcon skill={skill} size={34} /></span>
        <div className="offline-row-copy">
          <h3>{names[skill]}</h3>
          {connection.online ? <OfflineLessonControl skill={skill} name={names[skill]} heading={false} /> : <p><OfflineBadge skill={skill} /> <span className="offline-meta">Not downloaded</span></p>}
        </div>
        {connection.online && <a className="button secondary compact" href={builtinLessonHref(skill)}>Open<span className="sr-only"> {names[skill]}</span><ArrowRight size={17} aria-hidden="true" /></a>}
      </li>)}</ul>
    </section>}

    <InstallAppPanel />

    {offline.supported && downloaded.length > 0 && <section className="offline-section" aria-labelledby="offline-storage-title">
      <h2 id="offline-storage-title">Storage on this device</h2>
      <p>Downloads use {formatBytes(total)} of browser storage, including the offline library that opens when you have no connection. Removing downloads keeps your lesson progress; to start a lesson over, open it and choose Reset lesson progress under Prepare.</p>
      {confirming ? <div className="offline-actions">
        <button type="button" className="button secondary compact" onClick={() => { setConfirming(false); void removeAllLessons(); }}><Trash2 size={16} aria-hidden="true" />Remove all downloads</button>
        <button type="button" className="learning-text-button" onClick={() => setConfirming(false)}>Keep them</button>
      </div> : <button type="button" className="learning-text-button" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden="true" />Remove all downloads…</button>}
    </section>}
  </div>;
}
