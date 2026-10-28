import { expect, test } from '@playwright/test';
import { openControlled } from './helpers';

// Automated in headless Chromium. Real OS installation (Windows/macOS, Chrome,
// Edge, Safari Add to Dock) is a manual check: see docs/PWA.md.

test('the manifest is linked once, valid, and starts the app in the learning environment', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ id: '/learn', name: 'plsteach.me', start_url: '/learn', scope: '/', display: 'standalone', background_color: '#faf7f2', theme_color: '#22372c' });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes = await response.body();
    // PNG header: width and height are big-endian at bytes 16 and 20.
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  for (const path of ['/', '/learn', '/learn/tie', '/learn/offline', '/login', '/coach']) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]'), path).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  }
  await page.goto('/learn');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#22372c');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
});

test('the start URL opens the learning environment, not the marketing site', async ({ page }) => {
  await page.goto('/learn');
  await expect(page.getByRole('navigation', { name: 'Learning navigation' })).toBeVisible();
  for (const marketing of ['What will you learn?', 'Subscriptions', 'For organizations']) await expect(page.getByRole('link', { name: marketing })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your next');
});

test('one service worker controls the whole site and an old /coach/ registration is removed', async ({ page }) => {
  await page.goto('/coach');
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    await navigator.serviceWorker.register('/sw.js', { scope: '/coach/' });
  });
  await openControlled(page, '/learn');
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((registration) => new URL(registration.scope).pathname))).toEqual(['/']);
  await page.goto('/coach');
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(1);
});

test('the install action appears only when the browser offers installation, and a dismissal is respected', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __prompts: number }).__prompts = 0;
  });
  await page.goto('/learn');
  const install = page.getByRole('button', { name: 'Install app' });
  await expect(install).toHaveCount(0);
  // Chrome and Edge announce installability with beforeinstallprompt.
  const offer = () => page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    event.prompt = async () => { (window as unknown as { __prompts: number }).__prompts++; };
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  // The browser's own banner is suppressed; nothing opens by itself.
  expect(await offer()).toBe(true);
  await expect(install).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __prompts: number }).__prompts)).toBe(0);
  await install.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompts: number }).__prompts)).toBe(1);
  await expect(install).toHaveCount(0);
  // After a dismissal the button stays away, even when the browser offers again.
  await page.reload();
  await offer();
  await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
});

test('an installed app shows no install prompts', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => query.includes('display-mode: standalone') ? { ...original(query), matches: true, media: query, addEventListener() {}, removeEventListener() {} } as MediaQueryList : original(query);
  });
  await page.goto('/learn');
  await page.evaluate(() => { const event = new Event('beforeinstallprompt', { cancelable: true }); Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }); window.dispatchEvent(event); });
  await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  await page.goto('/learn/offline');
  await expect(page.getByText('You’re using the installed app.')).toBeVisible();
});

test.describe('Safari on macOS', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15' });
  test('explains Add to Dock instead of offering a download', async ({ page }) => {
    await page.goto('/learn');
    await page.getByRole('button', { name: 'Install app' }).click();
    await expect(page.getByRole('dialog', { name: 'Install plsteach.me' })).toContainText('File › Add to Dock');
    await page.getByRole('button', { name: 'Don’t show again' }).click();
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  });
});

test.describe('a browser without installation', () => {
  test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0' });
  test('shows no install button and explains the website keeps working', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
    await page.goto('/learn/offline');
    await expect(page.getByText('Everything keeps working here in the browser.')).toBeVisible();
    await expect(page.getByRole('link', { name: /download/i })).toHaveCount(0);
  });
});
