import { test, expect } from '@playwright/test';

test('production pages send security headers and cannot be framed', async ({ request }) => {
  const response = await request.get('/');
  const csp = response.headers()['content-security-policy'] || '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['strict-transport-security']).toContain('max-age=');
});

test('terms of use are linked from the footer and sign-up asks for consent', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, user: null, trial: null } }));
  await page.goto('/');
  await page.locator('footer').getByRole('link', { name: 'Terms of use' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Safety comes first' })).toBeVisible();
  await page.goto('/signup');
  await expect(page.getByRole('checkbox', { name: /16 or older/ })).toBeVisible();
});

test('internal evaluation tools are not reachable on the deployed site', async ({ request }) => {
  expect((await request.get('/coach/eval')).status()).toBe(404);
});
