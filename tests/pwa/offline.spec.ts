import { expect, test } from '@playwright/test';
import { cacheContents, downloadFromLesson, goOffline, goOnline, openControlled } from './helpers';

const progressOf = (page: import('@playwright/test').Page, skill: string) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem('plsteach.learning.v1') || '{"lessons":{}}').lessons[key] ?? null, skill);

test('a downloaded lesson works fully without a network, also after closing the window', async ({ context, page }) => {
  await openControlled(page, '/learn');
  // Download from the catalog card.
  await page.getByRole('button', { name: 'Download for offline: Tie a tie' }).click();
  await expect(page.locator('.catalog-card').filter({ hasText: 'Tie a tie' }).getByText('Available offline')).toBeVisible({ timeout: 30_000 });
  const caches = await cacheContents(page);
  const names = Object.keys(caches);
  expect(names.some((name) => name.startsWith('plsteach-offline:lesson:tie:'))).toBe(true);
  expect(names.some((name) => name.startsWith('plsteach-offline:shell:'))).toBe(true);

  await goOffline(context);
  await page.goto('/learn/tie');
  await expect(page.getByRole('heading', { level: 1, name: 'Tie a tie' })).toBeVisible();
  await expect(page.getByText('You’re offline. This lesson is downloaded, so you can keep practicing.')).toBeVisible();
  // Back and Next with self-checked checkpoints.
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByRole('button', { name: 'Previous lesson step' }).click();
  await expect(page.getByText('Step 2 of 7', { exact: true })).toBeVisible();
  await expect.poll(() => progressOf(page, 'tie')).toMatchObject({ step: 1 });
  expect((await progressOf(page, 'tie')).checkpoints.slice(0, 2)).toEqual(['self_checked', 'self_checked']);
  // Preparation, safety and the checkpoint record work offline.
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await expect(page.getByText('What you’ll need')).toBeVisible();
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('Your checkpoint record')).toBeVisible();
  await page.getByRole('button', { name: 'Step', exact: true }).click();

  // Close the window and open the app again, still offline, at its start URL.
  await page.close();
  const again = await context.newPage();
  await again.goto('/learn');
  await expect(again).toHaveURL(/\/learn\/offline\?from=%2Flearn$/);
  await expect(again.getByText('You’re offline. Your downloaded lessons are ready.')).toBeVisible();
  const ready = again.locator('.offline-row').filter({ hasText: 'Tie a tie' });
  await expect(ready).toContainText('Step 2 of 7');
  await expect(again.getByRole('heading', { name: 'Needs an internet connection' })).toBeVisible();
  await expect(again.locator('.offline-row').filter({ hasText: 'Care for your bike' })).toContainText('Not downloaded');
  await ready.getByRole('link', { name: /Resume/ }).click();
  await expect(again.getByText('Step 2 of 7', { exact: true })).toBeVisible();
  // Finish the walkthrough offline.
  for (let step = 1; step < 6; step++) await again.getByRole('button', { name: 'Next lesson step' }).click();
  await again.getByRole('button', { name: 'Finish walkthrough' }).click();
  await expect(again.getByText('Walkthrough complete', { exact: true })).toBeVisible();
  await expect.poll(() => progressOf(again, 'tie')).toMatchObject({ completed: true });
  await goOnline(context);
});

test('the app opens offline with honest notices for lessons that are not downloaded', async ({ context, page }) => {
  await downloadFromLesson(page, 'button');
  await goOffline(context);
  await page.goto('/learn/bike');
  await expect(page).toHaveURL(/\/learn\/offline\?from=%2Flearn%2Fbike$/);
  await expect(page.getByText('Care for your bike isn’t downloaded on this device, so it needs an internet connection.')).toBeVisible();
  await page.goto('/account');
  await expect(page.getByText(/Your account, sign-in and password links need an internet connection/)).toBeVisible();
  // A client-side link from a downloaded lesson falls back to a full navigation, never a blank page.
  await page.goto('/learn/button');
  await page.getByRole('link', { name: 'All lessons' }).click();
  await expect(page).toHaveURL(/\/learn\/offline/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Practice without');
  await goOnline(context);
});

test('an interrupted download is not presented as offline-ready and can be retried', async ({ context, page }) => {
  await openControlled(page, '/learn/drill');
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  let blocked = 0;
  await context.route('**/_next/static/css/**', (route) => { blocked++; return route.abort('internetdisconnected'); });
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText(/The connection was interrupted, so nothing was kept/)).toBeVisible({ timeout: 30_000 });
  expect(blocked).toBeGreaterThan(0);
  await expect(page.locator('.offline-control .offline-badge')).toHaveText('Download failed');
  const partial = Object.keys(await cacheContents(page)).filter((name) => name.includes(':drill:'));
  expect(partial).toEqual([]);
  await context.unroute('**/_next/static/css/**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Ready without internet')).toBeVisible({ timeout: 30_000 });
});

test('a full browser storage is reported and nothing partial is kept', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: async () => ({ quota: 2_000_000, usage: 1_900_000 }), persist: async () => false } });
  });
  await openControlled(page, '/learn/cooking');
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText(/There isn’t enough storage space in this browser/)).toBeVisible();
  expect(Object.keys(await cacheContents(page)).filter((name) => name.includes(':cooking:'))).toEqual([]);
});

test('removing a download keeps lesson progress, and resetting progress keeps the download', async ({ page }) => {
  await downloadFromLesson(page, 'laundry');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  const before = await progressOf(page, 'laundry');
  expect(before.step).toBe(2);
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await page.getByRole('button', { name: 'Remove download' }).click();
  await expect(page.getByRole('button', { name: 'Download for offline' })).toBeVisible();
  expect(Object.keys(await cacheContents(page)).filter((name) => name.includes(':laundry:'))).toEqual([]);
  expect(await progressOf(page, 'laundry')).toEqual(before);

  await page.getByRole('button', { name: 'Download for offline' }).click();
  await expect(page.getByText('Ready without internet')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Reset lesson progress' }).click();
  expect(await progressOf(page, 'laundry')).toBeNull();
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await expect(page.getByText('Ready without internet')).toBeVisible();
});

test('a damaged package is never used and can be repaired', async ({ context, page }) => {
  await downloadFromLesson(page, 'beard');
  await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.includes(':beard:'))!;
    const cache = await caches.open(name);
    const script = (await cache.keys()).find((request) => request.url.includes('/_next/static/chunks/'))!;
    await cache.delete(script);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await expect(page.getByText(/Some files of this download are missing/)).toBeVisible();
  await goOffline(context);
  await page.goto('/learn/beard');
  await expect(page).toHaveURL(/\/learn\/offline\?from=%2Flearn%2Fbeard/);
  await goOnline(context);
  await page.goto('/learn/beard');
  await page.getByRole('button', { name: 'Prepare', exact: true }).click();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Ready without internet')).toBeVisible({ timeout: 30_000 });
});

test('a new app version is announced calmly, never forces a reload, and keeps the old download working', async ({ context, page }) => {
  await downloadFromLesson(page, 'ironing');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.route('**/api/version', (route) => route.fulfill({ json: { version: 'next-release' }, headers: { 'Cache-Control': 'no-store' } }));
  await page.evaluate(() => { (window as unknown as { marker: boolean }).marker = true; });
  // The app checks again when the learner returns to the window.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/A new version of plsteach.me is ready. Your progress is saved; reload when you finish this step./)).toBeVisible();
  await expect(page.locator('.lesson-screen-count .offline-badge')).toHaveText('Update available');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
  await page.getByRole('button', { name: 'Later' }).click();
  await expect(page.getByText(/A new version of plsteach.me is ready/)).toHaveCount(0);
  // The previous download still opens offline until it is updated.
  await goOffline(context);
  await page.goto('/learn/ironing');
  await expect(page.getByRole('heading', { level: 1, name: /iron/i })).toBeVisible();
  await goOnline(context);
});
