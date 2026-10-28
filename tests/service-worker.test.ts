import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCacheStorage } from './fake-caches';

const origin = 'http://localhost:3100';
type Listener = (event: unknown) => void;
let listeners: Record<string, Listener>;
let storage: FakeCacheStorage;
let network: ReturnType<typeof vi.fn>;

function load() {
  listeners = {};
  storage = new FakeCacheStorage();
  network = vi.fn(async () => new Response('<html>live</html>', { headers: { 'Content-Type': 'text/html' } }));
  const self = { location: new URL(origin), addEventListener: (type: string, listener: Listener) => { listeners[type] = listener; }, registration: {}, clients: { claim: async () => {} }, skipWaiting: () => {} };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches: storage, fetch: network, Response, Request, Headers, URL, Set, Promise, setTimeout, clearTimeout, Date, Array, JSON });
}
function fetchEvent(path: string, { mode = 'no-cors', method = 'GET', headers = {} as Record<string, string> } = {}) {
  let responded: Promise<Response> | null = null;
  const url = path.startsWith('http') ? path : origin + path;
  const event = { request: { url, method, mode, headers: new Headers(headers) }, preloadResponse: Promise.resolve(undefined), respondWith: (value: Promise<Response>) => { responded = value; } };
  listeners.fetch(event);
  return responded as Promise<Response> | null;
}
async function addPackage(key: string, page: string, files: Record<string, string>, { complete = true, kind = 'lesson' } = {}) {
  const cache = await storage.open(`plsteach-offline:${kind}:${key}:v1:${Date.now()}`);
  for (const [path, body] of Object.entries(files)) await cache.put(path, new Response(body, { headers: { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'text/html' } }));
  const listed = complete ? Object.keys(files) : [...Object.keys(files), '/_next/static/chunks/missing.js'];
  await cache.put('/__plsteach-offline/package.json', Response.json({ format: 1, kind, skill: key === 'shell' ? null : key, page, version: 'v1', files: listed, bytes: 1, completedAt: Date.now() }));
}
beforeEach(load);

describe('requests the service worker never touches', () => {
  it.each([
    ['/api/progress', {}],
    ['/api/auth/session', {}],
    ['/api/coaching/check', { method: 'POST' }],
    ['/auth/callback?code=secret', { mode: 'navigate' }],
    ['/auth/confirm?token_hash=secret&type=recovery', { mode: 'navigate' }],
    ['/learn/tie?_rsc=abc', {}],
    ['/learn', { headers: { RSC: '1' } }],
    ['/account', { method: 'POST', mode: 'navigate' }],
    ['https://api.openai.com/v1/responses', {}],
    ['/_next/image?url=%2Fuploads%2Favatar.png&w=96&q=75', {}],
    ['/api/profile/avatar', {}],
  ])('%s', (path, options) => {
    expect(fetchEvent(path, options as never)).toBeNull();
  });
});

describe('navigations', () => {
  it('use the network first and store nothing', async () => {
    const response = await fetchEvent('/learn/tie', { mode: 'navigate' });
    expect(await response!.text()).toBe('<html>live</html>');
    const account = await fetchEvent('/account', { mode: 'navigate' });
    expect(await account!.text()).toBe('<html>live</html>');
    expect(await storage.keys()).toEqual([]);
  });

  it('open a complete downloaded lesson without a connection', async () => {
    await addPackage('tie', '/learn/tie', { '/learn/tie': '<html>tie offline</html>', '/_next/static/chunks/a.js': 'a' });
    network.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await (await fetchEvent('/learn/tie', { mode: 'navigate' }))!.text()).toBe('<html>tie offline</html>');
    expect(await (await fetchEvent('/_next/static/chunks/a.js'))!.text()).toBe('a');
  });

  it('prefer the downloaded copy when the service answers with a server error', async () => {
    await addPackage('tie', '/learn/tie', { '/learn/tie': '<html>tie offline</html>' });
    network.mockResolvedValue(new Response('worker error', { status: 503 }));
    expect(await (await fetchEvent('/learn/tie', { mode: 'navigate' }))!.text()).toBe('<html>tie offline</html>');
  });

  it('send other pages and incomplete packages to the offline library', async () => {
    await addPackage('shell', '/learn/offline', { '/learn/offline': '<html>library</html>' }, { kind: 'shell' });
    await addPackage('bike', '/learn/bike', { '/learn/bike': '<html>bike</html>' }, { complete: false });
    network.mockRejectedValue(new TypeError('Failed to fetch'));
    const bike = await fetchEvent('/learn/bike', { mode: 'navigate' });
    expect(bike!.status).toBe(302);
    expect(bike!.headers.get('location')).toBe(`${origin}/learn/offline?from=%2Flearn%2Fbike`);
    const start = await fetchEvent('/learn', { mode: 'navigate' });
    expect(start!.headers.get('location')).toBe(`${origin}/learn/offline?from=%2Flearn`);
    expect(await (await fetchEvent('/learn/offline?from=%2Flearn', { mode: 'navigate' }))!.text()).toBe('<html>library</html>');
  });

  it('fail normally when nothing was downloaded', async () => {
    network.mockRejectedValue(new TypeError('Failed to fetch'));
    const response = await fetchEvent('/learn', { mode: 'navigate' });
    expect(response!.type).toBe('error');
  });
});

it('answers public build files from the network when no package has them', async () => {
  const response = await fetchEvent('/_next/static/chunks/new.js');
  expect(network).toHaveBeenCalled();
  expect(await response!.text()).toBe('<html>live</html>');
  expect(await storage.keys()).toEqual([]);
});
