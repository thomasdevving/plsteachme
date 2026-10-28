'use client';
import { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useConnectivity } from '@/lib/offline/connectivity';
import { APP_VERSION } from '@/lib/pwa/config';
import { useCameraActive } from '@/lib/pwa/activity';
import { retryProgressSync, useProgressSyncStatus } from '@/lib/progress-sync-status';

/**
 * Calm, inline notices for the learning environment: being offline, and a new
 * app version. The app never reloads by itself; progress is saved on every step,
 * and an active camera check has to be stopped before reloading.
 */
export function AppStatus({ lesson = false, downloaded = false }: { lesson?: boolean; downloaded?: boolean }) {
  const connection = useConnectivity();
  const camera = useCameraActive();
  const sync = useProgressSyncStatus();
  const [later, setLater] = useState<string | null>(null);
  const update = connection.online && connection.latestVersion && connection.latestVersion !== APP_VERSION && APP_VERSION !== 'dev' && later !== connection.latestVersion ? connection.latestVersion : null;
  const syncError = connection.online && sync === 'error';
  if (connection.online && !update && !syncError) return null;
  return <div className="app-status" data-lesson={lesson || undefined}>
    {!connection.online && <p role="status" className="app-status-offline">
      <WifiOff size={16} aria-hidden="true" />
      <span className="app-status-full">{connection.reason === 'unreachable' ? 'plsteach.me can’t be reached right now.' : 'You’re offline.'} {lesson ? (downloaded ? 'This lesson is downloaded, so you can keep practicing.' : 'You can keep practicing the steps on this page.') : 'Your downloaded lessons are ready.'}</span>
      {lesson && <span className="app-status-short" aria-hidden="true">{connection.reason === 'unreachable' ? 'Connection unavailable.' : 'You’re offline.'} {downloaded ? 'Lesson ready.' : 'Keep practicing.'}</span>}
    </p>}
    {syncError && <p role="status" className="app-status-sync">
      <RefreshCw size={16} aria-hidden="true" />
      <span>Your progress is saved on this device. Account sync failed; we’ll retry automatically.</span>
      <button type="button" className="learning-text-button" onClick={retryProgressSync}>Retry sync</button>
    </p>}
    {update && <p role="status" className="app-status-update">
      <RefreshCw size={16} aria-hidden="true" />
      <span>A new version of plsteach.me is ready. Your progress is saved{lesson ? '; reload when you finish this step' : ''}.{camera ? ' Stop camera coaching first.' : ''}</span>
      <button type="button" className="learning-text-button" disabled={camera} onClick={() => window.location.reload()}>Reload now</button>
      <button type="button" className="learning-text-button" onClick={() => setLater(update)}>Later</button>
    </p>}
  </div>;
}
