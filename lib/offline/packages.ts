import { skillIds, type SkillId } from '../config';
import { builtinLessonHref } from '../lesson-navigation';
import { OFFLINE_CACHE_PREFIX, OFFLINE_SHELL_PATH, PACKAGE_FORMAT, PACKAGE_MARKER, appIcons } from '../pwa/config';

/**
 * Offline lesson packages.
 *
 * A package is one CacheStorage cache holding a public page (fetched without
 * cookies, so it cannot contain account data), the build files that page
 * references and a completion marker. The marker is written last, so a package
 * that was interrupted, ran out of space or is missing a file never counts as
 * downloaded. Packages are self-contained: the HTML and its JavaScript always
 * come from the same build. A replacement is complete before the old copy is
 * removed. Removing a package never touches lesson progress (localStorage).
 */
export type PackageKind = 'lesson' | 'shell';
export type PackageKey = SkillId | 'shell';
export type PackageInfo = {
  format: number;
  kind: PackageKind;
  skill: SkillId | null;
  page: string;
  version: string;
  files: string[];
  bytes: number;
  completedAt: number;
};
export type StoredPackage = { cacheName: string; key: PackageKey; info: PackageInfo };
export type DownloadFailure = 'offline' | 'interrupted' | 'quota' | 'server' | 'unsupported' | 'cancelled';
export class DownloadError extends Error {
  constructor(public readonly reason: DownloadFailure, message: string) { super(message); this.name = 'DownloadError'; }
}
export const failureMessages: Record<DownloadFailure, string> = {
  offline: 'You’re offline. Connect to the internet to download this lesson.',
  interrupted: 'The connection was interrupted, so nothing was kept. Try again when your connection is steady.',
  quota: 'There isn’t enough storage space in this browser. Remove another download or free up space, then try again.',
  server: 'plsteach.me couldn’t prepare this download right now. Please try again in a moment.',
  unsupported: 'This browser can’t keep lessons for offline use. You can keep learning online.',
  cancelled: 'The download was cancelled.',
};

/** A conservative estimate used before the first download, in bytes. */
export const ESTIMATED_PACKAGE_BYTES = 3_000_000;
/** An unfinished download older than this was abandoned (tab closed, crash). */
const ABANDONED_AFTER_MS = 15 * 60_000;

export const pagePath = (key: PackageKey) => key === 'shell' ? OFFLINE_SHELL_PATH : builtinLessonHref(key);
export const isPackageKey = (value: string): value is PackageKey => value === 'shell' || skillIds.includes(value as SkillId);

const cacheName = (key: PackageKey, version: string, startedAt: number) =>
  `${OFFLINE_CACHE_PREFIX}${key === 'shell' ? 'shell' : 'lesson'}:${key}:${encodeURIComponent(version)}:${startedAt}`;
export function parseCacheName(name: string): { key: PackageKey; startedAt: number } | null {
  if (!name.startsWith(OFFLINE_CACHE_PREFIX)) return null;
  const [kind, key, , startedAt] = name.slice(OFFLINE_CACHE_PREFIX.length).split(':');
  if (!isPackageKey(key ?? '') || (kind === 'shell') !== (key === 'shell') || !/^\d+$/.test(startedAt ?? '')) return null;
  return { key: key as PackageKey, startedAt: Number(startedAt) };
}

const decode = (value: string) => value.replace(/&amp;/g, '&');
const pathOf = (value: string, base: string) => {
  try {
    const url = new URL(decode(value), base);
    return url.origin === new URL(base).origin ? url.pathname + url.search : null;
  } catch { return null; }
};

/** Version stamp written into every page by the root layout. */
export function htmlVersion(html: string) {
  return /<meta\s+name="plsteach-version"\s+content="([^"]+)"/.exec(html)?.[1] ?? null;
}

/** Build files referenced by a page: scripts, styles, fonts and the optimized logo. */
export function pageAssets(html: string, base: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\<>]+/g)) {
    const path = pathOf(match[0], base);
    if (path) found.add(path);
  }
  // Optimized images in src and srcset; only the public logo and icons qualify.
  for (const match of html.matchAll(/\/_next\/image\?url=[^"'\s,\\<>]+/g)) {
    const path = pathOf(match[0], base);
    if (path && /^\/(?:brand|icons)\//.test(new URL(path, base).searchParams.get('url') ?? '')) found.add(path);
  }
  return [...found];
}

/** Fonts and images referenced from a stylesheet, resolved against it. */
export function stylesheetAssets(css: string, cssPath: string, base: string): string[] {
  const found = new Set<string>();
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    if (match[2].startsWith('data:')) continue;
    const path = pathOf(match[2], new URL(cssPath, base).href);
    if (path && /^\/(?:_next\/static|fonts|brand|icons)\//.test(path)) found.add(path);
  }
  return [...found];
}

/** Files every package carries so the installed app keeps its name and icon offline. */
const packageExtras = ['/manifest.webmanifest', '/brand/hands-filled.png', '/icons/apple-touch-icon.png', ...appIcons.map((icon) => icon.src)];

function quotaError(error: unknown) {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);
}
function classify(error: unknown, signal?: AbortSignal): DownloadError {
  if (error instanceof DownloadError) return error;
  if (signal?.aborted) return new DownloadError('cancelled', failureMessages.cancelled);
  if (quotaError(error)) return new DownloadError('quota', failureMessages.quota);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new DownloadError('offline', failureMessages.offline);
  return new DownloadError('interrupted', failureMessages.interrupted);
}

export function offlineSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'caches' in window && 'serviceWorker' in navigator;
}

/** Checks the browser's storage estimate before downloading. */
export async function ensureSpace(bytes: number) {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < bytes * 1.5)
      throw new DownloadError('quota', failureMessages.quota);
  } catch (error) { if (error instanceof DownloadError) throw error; /* No estimate: rely on write errors. */ }
}

async function readMarker(cache: Cache): Promise<PackageInfo | null> {
  const response = await cache.match(PACKAGE_MARKER);
  if (!response) return null;
  const info = await response.json().catch(() => null) as PackageInfo | null;
  if (!info || info.format !== PACKAGE_FORMAT || !Array.isArray(info.files) || typeof info.version !== 'string' || typeof info.page !== 'string') return null;
  return info;
}

/** Every complete package, newest first per key; damaged or partial caches are reported separately. */
export async function listPackages(): Promise<{ packages: StoredPackage[]; damaged: PackageKey[] }> {
  const packages: StoredPackage[] = [];
  const damaged = new Set<PackageKey>();
  for (const name of await caches.keys()) {
    const parsed = parseCacheName(name);
    if (!parsed) continue;
    const cache = await caches.open(name);
    const info = await readMarker(cache);
    if (!info) continue;
    const stored = new Set((await cache.keys()).map((request) => { const url = new URL(request.url); return url.pathname + url.search; }));
    if (info.page !== pagePath(parsed.key) || !info.files.every((file) => stored.has(file))) { damaged.add(parsed.key); continue; }
    packages.push({ cacheName: name, key: parsed.key, info });
  }
  packages.sort((a, b) => b.info.completedAt - a.info.completedAt);
  const newest = new Map<PackageKey, StoredPackage>();
  for (const item of packages) if (!newest.has(item.key)) newest.set(item.key, item);
  return { packages: [...newest.values()], damaged: [...damaged].filter((key) => !newest.has(key)) };
}

/** Removes abandoned partial downloads and superseded copies. Never removes a usable package. */
export async function cleanupPackages(now = Date.now()) {
  const { packages } = await listPackages();
  const keep = new Set(packages.map((item) => item.cacheName));
  const usable = new Set(packages.map((item) => item.key));
  for (const name of await caches.keys()) {
    const parsed = parseCacheName(name);
    if (!name.startsWith(OFFLINE_CACHE_PREFIX) || keep.has(name)) continue;
    if (!parsed) { await caches.delete(name); continue; }
    const finished = Boolean(await caches.open(name).then(readMarker));
    // Superseded copies go. A damaged copy stays until it is repaired or removed, so the
    // learner is told about it. A recent unfinished download may still run in another tab.
    if (finished ? usable.has(parsed.key) : now - parsed.startedAt > ABANDONED_AFTER_MS) await caches.delete(name);
  }
}

type Progress = (done: number, total: number) => void;

/** Keeps the page's own headers (including its security policy) minus transport details. */
function storedHeaders(headers: Headers) {
  const copy = new Headers(headers);
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie', 'set-cookie2']) copy.delete(name);
  return copy;
}

async function fetchFile(path: string, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal });
  } catch (error) { throw classify(error, signal); }
  if (!response.ok) throw new DownloadError('server', failureMessages.server);
  let body: ArrayBuffer;
  try { body = await response.arrayBuffer(); } catch (error) { throw classify(error, signal); }
  return { response, body };
}

/**
 * Downloads one package into a new cache. Resolves only when every file and
 * the marker are stored; on any failure the new cache is deleted again.
 */
export async function downloadPackage(key: PackageKey, { signal, onProgress, expectedBytes = ESTIMATED_PACKAGE_BYTES }: { signal?: AbortSignal; onProgress?: Progress; expectedBytes?: number } = {}): Promise<StoredPackage> {
  if (!offlineSupported()) throw new DownloadError('unsupported', failureMessages.unsupported);
  if (navigator.onLine === false) throw new DownloadError('offline', failureMessages.offline);
  await ensureSpace(expectedBytes);
  const page = pagePath(key);
  const base = window.location.origin;
  const startedAt = Date.now();
  let name: string | null = null;
  try {
    onProgress?.(0, 1);
    const { response, body } = await fetchFile(page, signal);
    const html = new TextDecoder().decode(body);
    const version = htmlVersion(html);
    if (!version || !(response.headers.get('content-type') ?? '').includes('text/html')) throw new DownloadError('server', failureMessages.server);
    name = cacheName(key, version, startedAt);
    const cache = await caches.open(name);
    const store = async (path: string, file: { response: Response; body: ArrayBuffer }) => {
      try {
        await cache.put(path, new Response(file.body, { status: file.response.status, statusText: file.response.statusText, headers: storedHeaders(file.response.headers) }));
      } catch (error) { throw classify(error, signal); }
    };
    await store(page, { response, body });
    const files = new Set([page]);
    const queue = [...pageAssets(html, base), ...packageExtras, ...(key === 'shell' ? ['/mascots/offline-practice.webp'] : [])];
    let bytes = body.byteLength, done = 1;
    onProgress?.(done, queue.length + 1);
    // A few files at a time; stylesheets add the fonts they reference.
    const worker = async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        if (files.has(path)) continue;
        files.add(path);
        const file = await fetchFile(path, signal);
        if (/\.css(?:\?|$)/.test(path)) for (const asset of stylesheetAssets(new TextDecoder().decode(file.body), path, base)) if (!files.has(asset)) queue.push(asset);
        await store(path, file);
        bytes += file.body.byteLength;
        onProgress?.(++done, done + queue.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (signal?.aborted) throw new DownloadError('cancelled', failureMessages.cancelled);
    const info: PackageInfo = { format: PACKAGE_FORMAT, kind: key === 'shell' ? 'shell' : 'lesson', skill: key === 'shell' ? null : key, page, version, files: [...files], bytes, completedAt: Date.now() };
    try {
      await cache.put(PACKAGE_MARKER, new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
    } catch (error) { throw classify(error, signal); }
    // Only now is the new copy usable, so older copies of this lesson can go.
    for (const other of await caches.keys()) if (other !== name && parseCacheName(other)?.key === key) await caches.delete(other);
    announceChange();
    return { cacheName: name, key, info };
  } catch (error) {
    if (name) await caches.delete(name).catch(() => {});
    throw classify(error, signal);
  }
}

/** Removes a downloaded package. Lesson progress lives elsewhere and is kept. */
export async function removePackage(key: PackageKey) {
  for (const name of await caches.keys()) if (parseCacheName(name)?.key === key) await caches.delete(name);
  announceChange();
}

/** Removes every offline package (used by "remove all" and data deletion). */
export async function removeAllPackages() {
  if (typeof caches === 'undefined') return;
  for (const name of await caches.keys()) if (name.startsWith(OFFLINE_CACHE_PREFIX)) await caches.delete(name);
  announceChange();
}

export const CHANNEL = 'plsteach-offline';
/** Tells the service worker and other open windows that packages changed. */
export function announceChange() {
  if (typeof window === 'undefined') return;
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'plsteach:packages-changed' }); } catch { /* No worker yet. */ }
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage('changed'); channel.close(); } catch { /* Older browsers. */ }
  window.dispatchEvent(new Event(CHANNEL));
}
