/*
 * plsteach.me service worker.
 *
 * It never stores anything by itself. Offline lesson packages are written to
 * CacheStorage by the page (lib/offline/packages.ts) only when a learner chooses
 * "Download for offline", and a package counts only once its completion marker
 * and every file it lists are present. This worker only decides what may be
 * answered from those packages:
 *
 * - /api/* and /auth/* are never intercepted: account, progress, AI and email
 *   confirmation traffic always goes straight to the network.
 * - Page navigations go to the network first. Only when the network fails, hangs
 *   or the service is unreachable does a downloaded lesson open from its package;
 *   any other page sends the learner to the public offline library.
 * - React Server Component requests are never answered from a cache.
 * - Public static files (content-hashed build files, icons, fonts, the logo)
 *   come from a complete package when one has them, otherwise from the network.
 *
 * Network responses are never written to a cache here, so account pages, profile
 * data, camera images and AI responses cannot end up in CacheStorage.
 */
const SW_VERSION = 1;
const PREFIX = 'plsteach-offline:';
const MARKER = '/__plsteach-offline/package.json';
const SHELL_PATH = '/learn/offline';
const NAVIGATION_TIMEOUT_MS = 8000;

/** Never intercepted, online or offline. */
const PASSTHROUGH = /^\/(?:api|auth)(?:\/|$)/;
/** Public files that may be answered from a complete package. */
const PUBLIC_ASSET = /^\/(?:_next\/static\/|icons\/|brand\/|fonts\/|mascots\/download-companion\.webp$|manifest\.webmanifest$)/;

self.addEventListener('install', () => {
  // This worker keeps no state of its own, so a new version can take over at once.
  // Open pages are never reloaded by it.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'plsteach:packages-changed') index = null;
  if (type === 'plsteach:version') event.source?.postMessage({ type: 'plsteach:version', version: SW_VERSION });
});

// A short-lived index of complete packages; pages announce downloads and removals.
let index = null;
let indexedAt = 0;
function completePackages() {
  if (!index || Date.now() - indexedAt > 10_000) {
    index = readPackages().catch(() => []);
    indexedAt = Date.now();
  }
  return index;
}

/** Complete packages only: the marker exists and lists files that are all present. */
async function readPackages() {
  const packages = [];
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX)) continue;
    try {
      const cache = await caches.open(name);
      const marker = await cache.match(MARKER);
      if (!marker) continue;
      const info = await marker.json();
      if (!info || !Array.isArray(info.files) || typeof info.page !== 'string') continue;
      const stored = new Set((await cache.keys()).map((request) => new URL(request.url).pathname + new URL(request.url).search));
      if (!info.files.every((file) => stored.has(file))) continue;
      packages.push({ name, cache, info });
    } catch { /* A damaged package is skipped; the page offers to download it again. */ }
  }
  return packages.sort((a, b) => (b.info.completedAt || 0) - (a.info.completedAt || 0));
}

function normalPath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/** The package response for a navigation, or a redirect to the offline library. */
async function offlineResponse(url) {
  const path = normalPath(url.pathname);
  const packages = await completePackages();
  const page = packages.find((item) => item.info.page === path);
  if (page) {
    const response = await page.cache.match(path, { ignoreVary: true, ignoreSearch: true });
    if (response) return response;
  }
  const shell = packages.find((item) => item.info.kind === 'shell');
  if (!shell) return null;
  if (path === SHELL_PATH) return shell.cache.match(SHELL_PATH, { ignoreVary: true, ignoreSearch: true });
  const target = new URL(SHELL_PATH, self.location.origin);
  target.searchParams.set('from', path);
  return Response.redirect(target.href, 302);
}

async function navigate(event) {
  const url = new URL(event.request.url);
  let settled = false;
  const network = (async () => {
    const preload = await event.preloadResponse;
    return preload || fetch(event.request);
  })();
  network.then(() => { settled = true; }, () => { settled = true; });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS, 'timeout'));
  try {
    const first = await Promise.race([network, timeout]);
    if (first === 'timeout' && !settled) {
      // A hanging connection: open the downloaded copy if there is one, otherwise keep waiting.
      const fallback = await offlineResponse(url);
      if (fallback) return fallback;
    }
    const response = await network;
    // The service is unreachable (gateway or worker error): prefer a downloaded copy.
    if (response.status >= 500) return (await offlineResponse(url)) || response;
    return response;
  } catch {
    return (await offlineResponse(url)) || Response.error();
  }
}

async function publicAsset(request) {
  const url = new URL(request.url);
  for (const item of await completePackages()) {
    const hit = await item.cache.match(url.pathname + url.search, { ignoreVary: true });
    if (hit) return hit;
  }
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PASSTHROUGH.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(event));
    return;
  }
  if (request.headers.get('RSC') || url.searchParams.has('_rsc')) return;
  const optimizedLogo = url.pathname === '/_next/image' && /^\/(?:brand|icons)\//.test(url.searchParams.get('url') || '');
  if (PUBLIC_ASSET.test(url.pathname) || optimizedLogo) event.respondWith(publicAsset(request));
});
