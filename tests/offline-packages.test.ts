// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCacheStorage } from './fake-caches';
import {
  cleanupPackages, downloadPackage, DownloadError, htmlVersion, listPackages, pageAssets, parseCacheName, removePackage, stylesheetAssets,
} from '../lib/offline/packages';
import { PACKAGE_MARKER } from '../lib/pwa/config';
import { PROGRESS_KEY, emptyLessonProgress, readProgress, saveLessonProgress } from '../lib/learning-progress';

const base = 'http://localhost:3100';
const html = (version = 'v1') => `<!doctype html><html><head><meta name="plsteach-version" content="${version}"/>
<link rel="stylesheet" href="/_next/static/css/app.css"/><script src="/_next/static/chunks/main.js" async=""></script>
<img srcSet="/_next/image?url=%2Fbrand%2Fhands-filled.png&amp;w=48&amp;q=75 1x, /_next/image?url=%2Fbrand%2Fhands-filled.png&amp;w=96&amp;q=75 2x" src="/_next/image?url=%2Fbrand%2Fhands-filled.png&amp;w=96&amp;q=75"/>
<img src="/_next/image?url=%2Fuploads%2Fprivate.png&amp;w=96&amp;q=75"/></head><body>Tie a tie</body></html>`;
const css = '@font-face{src:url(../media/font.woff2) format("woff2")}body{background:url(data:image/png;base64,AA==)}';

let storage: FakeCacheStorage;
let server: (path: string, init?: RequestInit) => Promise<Response>;
let requests: { path: string; init?: RequestInit }[];
function defaultServer(path: string) {
  if (path === '/learn/tie' || path === '/learn/offline') return Promise.resolve(new Response(html(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'", 'Content-Encoding': 'gzip' } }));
  if (path.endsWith('.css')) return Promise.resolve(new Response(css, { headers: { 'Content-Type': 'text/css' } }));
  return Promise.resolve(new Response(`file ${path}`));
}
beforeEach(() => {
  storage = new FakeCacheStorage();
  vi.stubGlobal('caches', storage);
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: { controller: null }, configurable: true });
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ quota: 1e9, usage: 0 }) }, configurable: true });
  requests = [];
  server = defaultServer;
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => { requests.push({ path: input, init }); return server(input, init); }));
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('reading pages', () => {
  it('finds build files, the public logo and the version, but not private images', () => {
    expect(htmlVersion(html('abc'))).toBe('abc');
    expect(pageAssets(html(), base).sort()).toEqual([
      '/_next/image?url=%2Fbrand%2Fhands-filled.png&w=48&q=75',
      '/_next/image?url=%2Fbrand%2Fhands-filled.png&w=96&q=75',
      '/_next/static/chunks/main.js',
      '/_next/static/css/app.css',
    ]);
    expect(stylesheetAssets(css, '/_next/static/css/app.css', base)).toEqual(['/_next/static/media/font.woff2']);
  });
  it('accepts only its own cache names', () => {
    expect(parseCacheName('plsteach-offline:lesson:tie:v1:123')).toEqual({ key: 'tie', startedAt: 123 });
    expect(parseCacheName('plsteach-offline:shell:shell:v1:5')).toEqual({ key: 'shell', startedAt: 5 });
    expect(parseCacheName('plsteach-offline:lesson:shell:v1:5')).toBeNull();
    expect(parseCacheName('plsteach-offline:lesson:unknown:v1:5')).toBeNull();
    expect(parseCacheName('other-cache')).toBeNull();
  });
});

describe('downloading a lesson package', () => {
  it('stores every file, fetches the page without cookies and writes the marker last', async () => {
    const order: string[] = [];
    const open = storage.open.bind(storage);
    vi.spyOn(storage, 'open').mockImplementation(async (name) => { const cache = await open(name); const put = cache.put.bind(cache); cache.put = async (key, value) => { order.push(String(key)); return put(key, value); }; return cache; });
    const result = await downloadPackage('tie');
    expect(result.info).toMatchObject({ kind: 'lesson', skill: 'tie', page: '/learn/tie', version: 'v1' });
    expect(order.at(-1)).toBe(PACKAGE_MARKER);
    expect(result.info.files).toEqual(expect.arrayContaining(['/learn/tie', '/_next/static/css/app.css', '/_next/static/media/font.woff2', '/manifest.webmanifest', '/icons/icon-512.png']));
    expect(result.info.files.some((file) => file.includes('uploads'))).toBe(false);
    for (const request of requests) expect(request.init).toMatchObject({ credentials: 'omit', redirect: 'error' });
    const cache = await storage.open(result.cacheName);
    const page = await cache.match('/learn/tie');
    expect(page?.headers.get('content-security-policy')).toBe("default-src 'self'");
    expect(page?.headers.get('content-encoding')).toBeNull();
    expect((await listPackages()).packages.map((item) => item.key)).toEqual(['tie']);
  });

  it('keeps nothing when the connection drops part-way, and can be retried', async () => {
    server = (path) => path.endsWith('main.js') ? Promise.reject(new TypeError('Failed to fetch')) : defaultServer(path);
    await expect(downloadPackage('tie')).rejects.toMatchObject({ reason: 'interrupted' });
    expect(await storage.keys()).toEqual([]);
    expect((await listPackages()).packages).toEqual([]);
    server = defaultServer;
    await downloadPackage('tie');
    expect((await listPackages()).packages).toHaveLength(1);
  });

  it('reports a server error without keeping a partial package', async () => {
    server = (path) => path.endsWith('.css') ? Promise.resolve(new Response('gone', { status: 404 })) : defaultServer(path);
    await expect(downloadPackage('tie')).rejects.toMatchObject({ reason: 'server' });
    expect(await storage.keys()).toEqual([]);
  });

  it('refuses to start without enough storage and cleans up when storage runs out', async () => {
    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ quota: 1_000_000, usage: 900_000 }) }, configurable: true });
    await expect(downloadPackage('tie')).rejects.toMatchObject({ reason: 'quota' });
    expect(requests).toEqual([]);
    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ quota: 1e9, usage: 0 }) }, configurable: true });
    storage.failPutFor = /main\.js/;
    const error = await downloadPackage('tie').catch((reason) => reason);
    expect(error).toBeInstanceOf(DownloadError);
    expect(error.reason).toBe('quota');
    expect(await storage.keys()).toEqual([]);
  });

  it('refuses pages without a version stamp or that are not HTML', async () => {
    server = (path) => path === '/learn/tie' ? Promise.resolve(new Response('{"user":1}', { headers: { 'Content-Type': 'application/json' } })) : defaultServer(path);
    await expect(downloadPackage('tie')).rejects.toMatchObject({ reason: 'server' });
    expect(await storage.keys()).toEqual([]);
  });

  it('replaces an older copy only after the new one is complete', async () => {
    const first = await downloadPackage('tie');
    server = (path) => path.endsWith('main.js') ? Promise.reject(new TypeError('offline')) : path === '/learn/tie' ? Promise.resolve(new Response(html('v2'), { headers: { 'Content-Type': 'text/html' } })) : defaultServer(path);
    await expect(downloadPackage('tie')).rejects.toBeInstanceOf(DownloadError);
    expect(await storage.keys()).toEqual([first.cacheName]);
    server = (path) => path === '/learn/tie' ? Promise.resolve(new Response(html('v2'), { headers: { 'Content-Type': 'text/html' } })) : defaultServer(path);
    const second = await downloadPackage('tie');
    expect(await storage.keys()).toEqual([second.cacheName]);
    expect(second.info.version).toBe('v2');
  });
});

describe('managing packages', () => {
  it('treats a package with a missing file as damaged, never as downloaded', async () => {
    const result = await downloadPackage('tie');
    await (await storage.open(result.cacheName)).delete('/_next/static/chunks/main.js');
    const listed = await listPackages();
    expect(listed.packages).toEqual([]);
    expect(listed.damaged).toEqual(['tie']);
  });

  it('keeps a damaged package for repair until a complete copy replaces it', async () => {
    const result = await downloadPackage('tie');
    await (await storage.open(result.cacheName)).delete('/_next/static/chunks/main.js');
    await cleanupPackages();
    expect(await storage.keys()).toEqual([result.cacheName]);
    const repaired = await downloadPackage('tie');
    expect(await storage.keys()).toEqual([repaired.cacheName]);
  });

  it('removes abandoned partial downloads but keeps recent ones and complete packages', async () => {
    const complete = await downloadPackage('tie');
    await storage.open('plsteach-offline:lesson:bike:v1:1000');
    const recent = `plsteach-offline:lesson:drill:v1:${Date.now()}`;
    await storage.open(recent);
    await storage.open('unrelated-cache');
    await cleanupPackages();
    expect((await storage.keys()).sort()).toEqual([complete.cacheName, recent, 'unrelated-cache'].sort());
  });

  it('removing a download keeps lesson progress', async () => {
    saveLessonProgress('tie', { ...emptyLessonProgress('tie'), step: 4, updatedAt: 99 });
    const before = localStorage.getItem(PROGRESS_KEY);
    await downloadPackage('tie');
    await removePackage('tie');
    expect(await storage.keys()).toEqual([]);
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(readProgress().lessons.tie?.step).toBe(4);
  });
});
