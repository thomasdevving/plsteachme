'use client';
import { useSyncExternalStore } from 'react';
import { NETWORK_FAILURE_EVENT } from '../network';

/**
 * Whether plsteach.me can be reached right now. `navigator.onLine` only says a
 * network interface is up, so the app also probes its own server and listens
 * for failed requests (reportNetworkFailure) before deciding.
 */
export type Connectivity = {
  /** False when the device is offline or the service did not answer. */
  online: boolean;
  /** Why the app considers itself offline. */
  reason: 'none' | 'device' | 'unreachable';
  /** True once at least one probe finished. */
  checked: boolean;
  /** The deployed app version reported by the server, when known. */
  latestVersion: string | null;
};

const PROBE_URL = '/api/version';
const PROBE_TIMEOUT_MS = 6000;
const OFFLINE_RETRY_MS = 20_000;
const SERVER_SNAPSHOT: Connectivity = { online: true, reason: 'none', checked: false, latestVersion: null };

let state: Connectivity = SERVER_SNAPSHOT;
let started = false;
let probing: Promise<Connectivity> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastVersionCheck = 0;
const listeners = new Set<() => void>();
// A function so TypeScript does not narrow the value across awaits.
const deviceOffline = () => navigator.onLine === false;

function set(next: Partial<Connectivity>) {
  const merged = { ...state, ...next };
  if (merged.online === state.online && merged.reason === state.reason && merged.checked === state.checked && merged.latestVersion === state.latestVersion) return;
  state = merged;
  for (const listener of listeners) listener();
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (!state.online) retryTimer = setTimeout(() => void probe(), OFFLINE_RETRY_MS);
}

/** Asks the server whether it is reachable; never throws. */
export function probe(): Promise<Connectivity> {
  if (typeof window === 'undefined') return Promise.resolve(state);
  if (probing) return probing;
  probing = (async () => {
    if (deviceOffline()) { set({ online: false, reason: 'device', checked: true }); return state; }
    try {
      const response = await fetch(PROBE_URL, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      if (response.status >= 500) throw new Error('unreachable');
      const data = await response.json().catch(() => null) as { version?: unknown } | null;
      lastVersionCheck = Date.now();
      set({ online: true, reason: 'none', checked: true, latestVersion: typeof data?.version === 'string' ? data.version : state.latestVersion });
    } catch {
      set({ online: false, reason: deviceOffline() ? 'device' : 'unreachable', checked: true });
    }
    return state;
  })().finally(() => { probing = null; });
  return probing;
}

/** Called after a request failed at the network level; confirms with a probe. */
export function reportNetworkFailure() {
  if (typeof window === 'undefined') return;
  void probe();
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (deviceOffline()) set({ online: false, reason: 'device', checked: true });
  void probe();
  window.addEventListener('offline', () => set({ online: false, reason: 'device', checked: true }));
  window.addEventListener('online', () => void probe());
  window.addEventListener(NETWORK_FAILURE_EVENT, reportNetworkFailure);
  // Recheck when the learner comes back to the window; also picks up new app versions.
  const recheck = () => {
    if (document.visibilityState !== 'visible') return;
    if (!state.online || Date.now() - lastVersionCheck > 5 * 60_000) void probe();
  };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('focus', recheck);
}

export function subscribeConnectivity(listener: () => void) {
  start();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getConnectivity() {
  // Before the first probe, a device that reports no network is already offline.
  if (!started && state.online && typeof navigator !== 'undefined' && deviceOffline()) state = { ...state, online: false, reason: 'device', checked: true };
  return state;
}
/** The live value, for effects that run before the hook has caught up (hydration). */
export function onlineNow() { return getConnectivity().online; }

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, () => SERVER_SNAPSHOT);
}

/** Test helper: resets module state between tests. */
export function resetConnectivityForTests() {
  state = SERVER_SNAPSHOT; started = false; probing = null; lastVersionCheck = 0;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null; listeners.clear();
}
