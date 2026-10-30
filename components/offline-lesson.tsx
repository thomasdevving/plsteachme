'use client';
import { useId } from 'react';
import { CircleCheck, CloudDownload, RefreshCw, Trash2, TriangleAlert, WifiOff } from 'lucide-react';
import type { SkillId } from '@/lib/config';
import { useConnectivity } from '@/lib/offline/connectivity';
import {
  cancelDownload, currentVersion, downloadLesson, formatBytes, lessonStatus, removeLesson, statusLabels, useOfflineLessons,
  type LessonOfflineStatus, type OfflineState,
} from '@/lib/offline/store';

function useLessonOffline(skill: SkillId) {
  const offline = useOfflineLessons();
  const connection = useConnectivity();
  const status = lessonStatus(offline, skill, connection.latestVersion ?? currentVersion());
  return { offline, connection, status, item: offline.packages[skill], progress: offline.downloads[skill], failure: offline.failures[skill] };
}

function percent(progress?: { done: number; total: number }) {
  return progress ? Math.min(99, Math.round((progress.done / Math.max(progress.total, 1)) * 100)) : 0;
}

function failureText(offline: OfflineState, skill: SkillId) {
  return offline.failures[skill]?.message ?? (offline.damaged.includes(skill) ? 'Some files of this download are missing, so it can’t be used offline. Download it again to repair it.' : 'The download didn’t finish.');
}

const StatusIcon = ({ status }: { status: LessonOfflineStatus }) =>
  status === 'offline' ? <CircleCheck size={15} aria-hidden="true" /> : status === 'failed' ? <TriangleAlert size={15} aria-hidden="true" /> : status === 'update' ? <RefreshCw size={15} aria-hidden="true" /> : <CloudDownload size={15} aria-hidden="true" />;

/** A small state label. */
export function OfflineBadge({ skill, hideOnline = false }: { skill: SkillId; hideOnline?: boolean }) {
  const { offline, status, progress } = useLessonOffline(skill);
  if (!offline.ready || !offline.supported || (hideOnline && status === 'online')) return null;
  return <span className="offline-badge" data-offline-status={status}><StatusIcon status={status} />{status === 'downloading' ? `${statusLabels.downloading} ${percent(progress)}%` : statusLabels[status]}</span>;
}

/** Full control for one built-in lesson: download, progress, update, retry and remove. */
export function OfflineLessonControl({ skill, name, heading = true, compact = false }: { skill: SkillId; name: string; heading?: boolean; compact?: boolean }) {
  const { offline, connection, status, item, progress } = useLessonOffline(skill);
  const id = useId();
  if (!offline.ready) return null;
  if (!offline.supported) return <section className="offline-control" aria-labelledby={`${id}-title`}>
    {heading && <h3 id={`${id}-title`}>Offline use</h3>}
    <p>{process.env.NODE_ENV === 'production' ? 'Offline downloads aren’t available in this browser. You can keep learning online.' : 'Offline downloads work in production builds only; development never runs the service worker.'}</p>
  </section>;
  const disabled = !connection.online;
  return <section className="offline-control" aria-labelledby={`${id}-title`} data-offline-status={status}>
    <div className="offline-control-head">
      {heading ? <h3 id={`${id}-title`}>Offline use</h3> : <span id={`${id}-title`} className="sr-only">Offline use for {name}</span>}
      <OfflineBadge skill={skill} />
    </div>
    {status === 'online' && !compact && <p>Keep the illustrated steps, materials, safety notes and checkpoints on this device to practice without internet. Camera coaching and questions still need a connection.</p>}
    {status === 'downloading' && <>
      <div className="offline-progress" role="progressbar" aria-label={`Downloading ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(progress)}><span style={{ width: `${percent(progress)}%` }} /></div>
      <p className="offline-meta">Saving files… {percent(progress)}%. Keep this page open until it finishes.</p>
    </>}
    {status === 'offline' && item && <p className="offline-meta">Ready without internet · {formatBytes(item.info.bytes)} · downloaded {new Date(item.info.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
    {status === 'update' && <p>A newer version of plsteach.me is available. Your downloaded copy keeps working until you update it.</p>}
    {status === 'failed' && <p role="alert" className="offline-error">{failureText(offline, skill)}</p>}
    <div className="offline-actions">
      {status === 'online' && <button type="button" className="button secondary compact" disabled={disabled} onClick={() => void downloadLesson(skill)}><CloudDownload size={17} aria-hidden="true" />Download for offline</button>}
      {status === 'downloading' && <button type="button" className="learning-text-button" onClick={() => cancelDownload(skill)}>Cancel download</button>}
      {status === 'update' && <button type="button" className="button secondary compact" disabled={disabled} onClick={() => void downloadLesson(skill)}><RefreshCw size={17} aria-hidden="true" />Update download</button>}
      {status === 'failed' && <button type="button" className="button secondary compact" disabled={disabled} onClick={() => void downloadLesson(skill)}><RefreshCw size={17} aria-hidden="true" />Try again</button>}
      {(item || offline.damaged.includes(skill)) && status !== 'downloading' && <button type="button" className="learning-text-button" onClick={() => void removeLesson(skill)}><Trash2 size={15} aria-hidden="true" />Remove download</button>}
    </div>
    {disabled && status !== 'offline' && status !== 'downloading' && <p className="offline-meta">Connect to the internet to {status === 'update' ? 'update' : 'download'} this lesson.</p>}
    {(item || status === 'update') && <p className="offline-meta">Removing the download keeps your lesson progress.</p>}
  </section>;
}

/** One line on a catalog card: the state, and the next useful action. */
export function OfflineCardAction({ skill, name }: { skill: SkillId; name: string }) {
  const { offline, connection, status, progress } = useLessonOffline(skill);
  if (!offline.ready || !offline.supported) return null;
  if (status === 'offline' || status === 'downloading') return <OfflineBadge skill={skill} />;
  if (!connection.online) return status === 'online' ? <span className="offline-badge" data-offline-status="needs-network"><WifiOff size={15} aria-hidden="true" />Needs an internet connection</span> : <OfflineBadge skill={skill} />;
  const label = status === 'online' ? 'Download for offline' : status === 'update' ? 'Update download' : 'Retry download';
  return <button type="button" className="offline-card-action" data-offline-status={status} aria-label={`${label}: ${name}`} onClick={() => void downloadLesson(skill)}>
    <StatusIcon status={status} />{status === 'online' ? label : `${statusLabels[status]} · ${status === 'update' ? 'Update' : 'Retry'}`}{progress ? ` ${percent(progress)}%` : ''}
  </button>;
}
