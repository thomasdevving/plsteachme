import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { downloadFromLesson, openControlled } from './helpers';

const violations = async (page: import('@playwright/test').Page, include?: string) => {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  return (await (include ? builder.include(include) : builder).analyze()).violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.target) }));
};

test('the website band, offline library and download controls meet WCAG AA', async ({ context, page }) => {
  await page.goto('/');
  expect(await violations(page, '.app-download')).toEqual([]);
  await downloadFromLesson(page, 'tie');
  expect(await violations(page, '.offline-control')).toEqual([]);
  await openControlled(page, '/learn/offline');
  await expect(page.locator('.offline-row').first()).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await context.setOffline(true);
  await page.goto('/learn');
  await expect(page.getByText('You’re offline. Your downloaded lessons are ready.')).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.goto('/learn/tie');
  await expect(page.getByText(/This lesson is downloaded/)).toBeVisible();
  expect(await violations(page, '.lesson-screen-heading')).toEqual([]);
  await context.setOffline(false);
});
