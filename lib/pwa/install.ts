'use client';
import { useSyncExternalStore } from 'react';

/**
 * How this browser can install plsteach.me:
 * - prompt: Chrome or Edge offered their install prompt (beforeinstallprompt).
 * - safari-dock: Safari on macOS (Sonoma or later): File › Add to Dock.
 * - ios: Safari on iPhone or iPad: Share › Add to Home Screen.
 * - installed: already running as the installed app.
 * - unsupported: no install option; the website keeps working as usual.
 */
export type InstallMode = 'prompt' | 'safari-dock' | 'ios' | 'installed' | 'unsupported';
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export const INSTALL_DISMISSED_KEY = 'plsteach.install-dismissed.v1';
/** After someone says no, the header button stays away this long. */
export const INSTALL_QUIET_MS = 30 * 24 * 60 * 60 * 1000;

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => { snapshot = compute(); for (const listener of listeners) listener(); };

if (typeof window !== 'undefined') {
  // Registered when this module loads so the event is not missed before React hydrates.
  // Keeping the event also stops the browser from showing its own banner on every visit.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; notify(); });
}

export function detectSafari(userAgent: string, maxTouchPoints: number): 'safari-dock' | 'ios' | null {
  const safari = /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox|SamsungBrowser/.test(userAgent);
  if (!safari) return null;
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  // Add to Dock arrived in Safari 17 (macOS Sonoma).
  const version = Number(/Version\/(\d+)/.exec(userAgent)?.[1] ?? 0);
  return /Macintosh/.test(userAgent) && version >= 17 ? 'safari-dock' : null;
}

function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: minimal-ui)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function installDismissed(now = Date.now()) {
  try {
    const at = Number(localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && now - at < INSTALL_QUIET_MS;
  } catch { return false; }
}
export function dismissInstall() {
  try { localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now())); } catch { /* Private browsing. */ }
  notify();
}

type Snapshot = { mode: InstallMode; dismissed: boolean };
const SERVER: Snapshot = { mode: 'unsupported', dismissed: true };
let snapshot: Snapshot = SERVER;
function compute(): Snapshot {
  if (typeof window === 'undefined') return SERVER;
  const mode: InstallMode = installed || standalone() ? 'installed' : deferred ? 'prompt' : detectSafari(navigator.userAgent, navigator.maxTouchPoints ?? 0) ?? 'unsupported';
  return { mode, dismissed: installDismissed() };
}

/** Opens the browser's own install prompt; returns whether the app was installed. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null; // A prompt event can only be used once.
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'dismissed') dismissInstall();
  else notify();
  return outcome === 'accepted';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  snapshot = compute();
  const media = window.matchMedia?.('(display-mode: standalone)');
  media?.addEventListener?.('change', notify);
  return () => { listeners.delete(listener); media?.removeEventListener?.('change', notify); };
}
export function useInstall(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER);
}
