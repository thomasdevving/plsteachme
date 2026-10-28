import { expect, test } from '@playwright/test';
import { downloadFromLesson, goOffline, goOnline, mockSignedIn } from './helpers';

const tie = (step: number, updatedAt: number, checkpoint = 'self_checked') => ({
  contentVersion: 1, step, completed: false, updatedAt,
  checkpoints: Array.from({ length: 7 }, (_, index) => (index < step ? checkpoint : 'pending')),
});

test('progress made offline is saved locally and synced when the connection returns', async ({ context, page }) => {
  const saved: { lessonKey: string; data: { step: number }; updatedAt: number }[] = [];
  await mockSignedIn(context, { onSave: (body) => saved.push(body as never) });
  await downloadFromLesson(page, 'tie');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await goOffline(context);
  await page.reload();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  await page.waitForTimeout(1200);
  expect(saved.filter((item) => item.data.step === 2)).toEqual([]);
  await goOnline(context);
  await expect.poll(() => saved.some((item) => item.lessonKey === 'builtin:tie' && item.data.step === 2), { timeout: 15_000 }).toBe(true);
});

test('a newer copy from the account is not overwritten by an older local copy', async ({ context, page }) => {
  const saved: { lessonKey: string; data: { step: number } }[] = [];
  const remoteTime = Date.now() + 60_000;
  await mockSignedIn(context, { progress: [{ lessonKey: 'builtin:tie', data: tie(5, remoteTime), updatedAt: remoteTime }], onSave: (body) => saved.push(body as never) });
  await page.addInitScript((value) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('plsteach.learning.v1', JSON.stringify({ version: 1, lessons: { tie: value } })); sessionStorage.setItem('seeded', '1'); } }, tie(1, 1000));
  await page.goto('/learn/tie');
  await expect(page.getByText('Step 6 of 7', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(saved.filter((item) => item.lessonKey === 'builtin:tie' && item.data.step === 1)).toEqual([]);
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('plsteach.learning.v1')!).lessons.tie);
  expect(local).toMatchObject({ step: 5, updatedAt: remoteTime });
  // Checkpoint kinds stay distinct.
  expect(local.checkpoints.slice(0, 5)).toEqual(Array(5).fill('self_checked'));
});

for (const failure of ['GET', 'POST']) test(`progress sync recovers visibly from an HTTP 503 on ${failure}`, async ({ context, page }) => {
  await mockSignedIn(context);
  let failing = true;
  const saved: unknown[] = [];
  await context.route('**/api/progress', route => {
    const method = route.request().method();
    if (failing && method === failure) return route.fulfill({ status: 503, json: { error: 'Temporary error' } });
    if (method === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: { progress: method === 'POST' ? null : [] } });
  });
  await page.goto('/learn/tie');
  await page.getByRole('button', { name: 'Next lesson step', exact: true }).click();
  await expect(page.getByText('Your progress is saved on this device. Account sync failed; we’ll retry automatically.')).toBeVisible();
  expect(saved).toEqual([]);
  failing = false;
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect.poll(() => saved).toContainEqual(expect.objectContaining({ lessonKey: 'builtin:tie', data: expect.objectContaining({ step: 1 }) }));
  await expect(page.getByRole('button', { name: 'Retry sync', exact: true })).toHaveCount(0);
});

test('the account name returns after starting a downloaded lesson offline', async ({ context, page }) => {
  let offline = false;
  await context.route('**/api/auth/session', route => offline ? route.abort('internetdisconnected') : route.fulfill({ json: { configured: true, user: { id: '11111111-1111-4111-8111-111111111111' }, trial: null } }));
  await context.route('**/api/profile', route => offline ? route.abort('internetdisconnected') : route.fulfill({ json: { profile: { username: 'ada_l' } } }));
  await context.route('**/api/progress', route => offline ? route.abort('internetdisconnected') : route.fulfill({ json: { progress: [] } }));
  await downloadFromLesson(page, 'tie');
  await expect(page.getByRole('link', { name: 'ada_l', exact: true })).toBeVisible();
  offline = true;
  await goOffline(context);
  await page.reload();
  await expect(page.locator('.lesson-account-link')).toHaveText('Account');
  offline = false;
  await goOnline(context);
  await expect(page.getByRole('link', { name: 'ada_l', exact: true })).toBeVisible();
});
