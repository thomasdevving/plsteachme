import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Opens a page and waits until the service worker controls it. */
export async function openControlled(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

/** Every URL in this origin's CacheStorage, per cache. */
export function cacheContents(page: Page) {
  return page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const name of await caches.keys()) out[name] = (await (await caches.open(name)).keys()).map((request) => { const url = new URL(request.url); return url.pathname + url.search; });
    return out;
  });
}

/** Downloads a built-in lesson from its Prepare view and waits until it is complete. */
export async function downloadFromLesson(page: Page, skill: string) {
  await openControlled(page, `/learn/${skill}`);
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText('Ready without internet')).toBeVisible({ timeout: 30_000 });
}

export async function goOffline(context: BrowserContext) { await context.setOffline(true); }
export async function goOnline(context: BrowserContext) { await context.setOffline(false); }

/** A signed-in learner as far as the browser can tell; the server is mocked. */
export async function mockSignedIn(page: Page | BrowserContext, { progress = [] as unknown[], onSave }: { progress?: unknown[]; onSave?: (body: unknown) => void } = {}) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { configured: true, user: { id: '11111111-1111-4111-8111-111111111111', email: 'ada@example.test' }, trial: null } }));
  await page.route('**/api/profile', (route) => route.fulfill({ json: { profile: { username: 'ada_l', firstName: 'Ada', lastName: 'Lovelace', hasAvatar: false } } }));
  await page.route('**/api/progress', (route) => {
    if (route.request().method() === 'POST') { onSave?.(route.request().postDataJSON()); return route.fulfill({ json: { progress: null } }); }
    return route.fulfill({ json: { progress } });
  });
}
