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
