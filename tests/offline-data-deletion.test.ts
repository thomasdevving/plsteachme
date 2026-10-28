// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('idb-keyval', () => ({ createStore: () => ({}), clear: vi.fn(async () => {}), get: vi.fn(), set: vi.fn(), del: vi.fn(), entries: vi.fn(), update: vi.fn() }));
import { FakeCacheStorage } from './fake-caches';
import { deleteMyData } from '../lib/storage/store';
import { INSTALL_DISMISSED_KEY } from '../lib/pwa/install';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('deleting my data also removes offline lesson downloads and the install preference', async () => {
  const storage = new FakeCacheStorage();
  vi.stubGlobal('caches', storage);
  await storage.open('plsteach-offline:lesson:tie:v1:1');
  await storage.open('plsteach-offline:shell:shell:v1:1');
  await storage.open('another-app-cache');
  localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  await deleteMyData();
  expect(await storage.keys()).toEqual(['another-app-cache']);
  expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBeNull();
});
