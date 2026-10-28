// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getConnectivity, probe, resetConnectivityForTests, subscribeConnectivity } from '../lib/offline/connectivity';
import { fetchWithTimeout } from '../lib/network';

const online = (value: boolean) => Object.defineProperty(navigator, 'onLine', { value, configurable: true });
beforeEach(() => { resetConnectivityForTests(); online(true); });
afterEach(() => { vi.unstubAllGlobals(); resetConnectivityForTests(); online(true); });

it('does not trust navigator.onLine alone: an unreachable service counts as offline', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  await probe();
  expect(getConnectivity()).toMatchObject({ online: false, reason: 'unreachable', checked: true });
});

it('treats gateway and worker errors as unreachable', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
  await probe();
  expect(getConnectivity()).toMatchObject({ online: false, reason: 'unreachable' });
});

it('is online, with the deployed version, when the probe answers', async () => {
  const fetch = vi.fn(async () => Response.json({ version: 'v9' }));
  vi.stubGlobal('fetch', fetch);
  await probe();
  expect(getConnectivity()).toMatchObject({ online: true, reason: 'none', latestVersion: 'v9' });
  expect(fetch).toHaveBeenCalledWith('/api/version', expect.objectContaining({ cache: 'no-store', credentials: 'omit' }));
});

it('reports the device as offline without making a request', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  online(false);
  await probe();
  expect(getConnectivity()).toMatchObject({ online: false, reason: 'device' });
  expect(fetch).not.toHaveBeenCalled();
});

it('rechecks after a failed request and after the browser comes back online', async () => {
  let reachable = true;
  const fetch = vi.fn(async (url: string) => {
    if (!reachable) throw new TypeError('Failed to fetch');
    return url === '/api/version' ? Response.json({ version: 'v1' }) : Response.json({});
  });
  vi.stubGlobal('fetch', fetch);
  const unsubscribe = subscribeConnectivity(() => {});
  await vi.waitFor(() => expect(getConnectivity().checked).toBe(true));
  expect(getConnectivity().online).toBe(true);
  reachable = false;
  await expect(fetchWithTimeout('/api/profile')).rejects.toThrow();
  await vi.waitFor(() => expect(getConnectivity()).toMatchObject({ online: false, reason: 'unreachable' }));
  reachable = true;
  window.dispatchEvent(new Event('online'));
  await vi.waitFor(() => expect(getConnectivity().online).toBe(true));
  unsubscribe();
});
