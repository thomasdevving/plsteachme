import { expect, test } from '@playwright/test';
import { cacheContents, downloadFromLesson, goOffline, goOnline, mockSignedIn, openControlled } from './helpers';
import { installActiveTrial } from '../e2e/trial-fixture';

const ALLOWED = [
  /^\/learn\/(?:offline|tie|shaving|beard|ironing|button|drill|laundry|cooking|bike)$/,
  /^\/_next\/static\//,
  /^\/_next\/image\?url=%2F(?:brand|icons)%2F/,
  /^\/(?:icons|brand)\/[\w-]+\.png$/,
  /^\/manifest\.webmanifest$/,
  /^\/__plsteach-offline\/package\.json$/,
];

test('CacheStorage holds only public lesson files: no API, auth, account or profile data', async ({ context, page }) => {
  await context.addCookies([{ name: 'sb-test-auth-token', value: 'secret-session', domain: 'localhost', path: '/' }]);
  await mockSignedIn(page);
  const pageRequests: { url: string; cookie?: string }[] = [];
  page.on('request', async (request) => { if (/\/learn\/(?:tie|offline)$/.test(new URL(request.url()).pathname) && request.resourceType() === 'fetch') pageRequests.push({ url: request.url(), cookie: (await request.allHeaders()).cookie }); });
  await openControlled(page, '/learn');
  await expect(page.getByRole('link', { name: 'ada_l' })).toBeVisible();
  for (const path of ['/account', '/login', '/signup', '/forgot-password', '/learn/offline']) await page.goto(path);
  await downloadFromLesson(page, 'tie');
  // Package pages were fetched without the session cookie.
  expect(pageRequests.length).toBeGreaterThanOrEqual(1);
  for (const request of pageRequests) expect(request.cookie ?? '').not.toContain('secret-session');
  const contents = await cacheContents(page);
  for (const [name, urls] of Object.entries(contents)) {
    expect(name.startsWith('plsteach-offline:'), name).toBe(true);
    for (const url of urls) expect(ALLOWED.some((pattern) => pattern.test(url)), `${name}: ${url}`).toBe(true);
  }
  // The offline pages carry no account details.
  const stored = await page.evaluate(async () => {
    const texts: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) if (/\/learn\//.test(request.url)) texts.push(await (await cache.match(request))!.text());
    }
    return texts.join('\n');
  });
  for (const secret of ['ada_l', 'Lovelace', 'ada@example.test', 'secret-session']) expect(stored).not.toContain(secret);
  // Security headers stay on the cached page.
  const csp = await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.includes(':tie:'))!;
    return (await (await caches.open(name)).match('/learn/tie'))!.headers.get('content-security-policy');
  });
  expect(csp).toContain("frame-ancestors 'none'");
});

test('downloading never touches the trial or AI services', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (request) => { const path = new URL(request.url()).pathname; if (/^\/api\/(?:trial|coaching|ask|verify-step|vision)/.test(path) && request.method() !== 'GET') calls.push(`${request.method()} ${path}`); });
  await downloadFromLesson(page, 'shaving');
  expect(calls).toEqual([]);
});

test('offline practice sends no AI requests, keeps no images and never confirms by camera', async ({ context, page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    (window as unknown as { cameraRequests: number }).cameraRequests = 0;
    if (original) navigator.mediaDevices.getUserMedia = (constraints) => { (window as unknown as { cameraRequests: number }).cameraRequests++; return original(constraints); };
  });
  await downloadFromLesson(page, 'tie');
  const aiRequests: string[] = [];
  page.on('request', (request) => { const url = new URL(request.url()); if (/^\/api\/(?:coaching|ask|verify-step|vision|trial)/.test(url.pathname) || url.hostname.includes('openai')) aiRequests.push(request.url()); });
  await goOffline(context);
  await page.goto('/learn/tie');
  await page.getByRole('button', { name: 'Coach', exact: true }).click();
  await expect(page.getByText('Camera coaching needs an internet connection. You can keep practicing with the illustrated steps.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start camera coaching' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.getByRole('button', { name: 'Next lesson step' }).click();
  expect(aiRequests).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { cameraRequests: number }).cameraRequests)).toBe(0);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('plsteach.learning.v1')!).lessons.tie.checkpoints);
  expect(record).not.toContain('camera_confirmed');
  expect(record[0]).toBe('self_checked');
  // Nothing waits in storage to be sent later.
  const stored = await page.evaluate(async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), caches: await caches.keys() }));
  expect(JSON.stringify(stored)).not.toMatch(/frame|image|queue|outbox|pending-report/i);
  await goOnline(context);
});

test('losing the connection stops an active camera check; coming back does not restart it', async ({ context, page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const w = window as unknown as { cameraRequests: number; streams: MediaStream[] };
    w.cameraRequests = 0; w.streams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => { w.cameraRequests++; const stream = await original(constraints); w.streams.push(stream); return stream; };
  });
  await installActiveTrial(page);
  await page.route('**/api/coaching/session', (route) => route.fulfill({ json: route.request().method() === 'GET' ? { available: true } : { ok: true } }));
  let checks = 0;
  await page.route('**/api/coaching/check', (route) => { checks++; return route.fulfill({ status: 503, json: {} }); });
  await openControlled(page, '/learn/tie');
  await page.getByRole('button', { name: 'Coach', exact: true }).click();
  await page.getByLabel('I am 16 or older.').check();
  await page.getByLabel('I agree to automatic image checks while camera coaching is active.').check();
  await page.getByRole('button', { name: 'Start camera coaching' }).click();
  await expect(page.locator('.camera-preview video')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cameraRequests: number }).cameraRequests)).toBe(1);

  await goOffline(context);
  await expect(page.getByText('Camera coaching needs an internet connection. You can keep practicing with the illustrated steps.').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { streams: MediaStream[] }).streams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended')))).toBe(true);
  const checksWhenOffline = checks;

  await goOnline(context);
  await expect(page.getByRole('button', { name: 'Start camera coaching' })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { cameraRequests: number }).cameraRequests)).toBe(1);
  expect(checks).toBe(checksWhenOffline);
});

test('auth confirmation and recovery links are passed straight to the server inside the app', async ({ page }) => {
  await openControlled(page, '/learn');
  const authResponses: boolean[] = [];
  page.on('response', (response) => { if (new URL(response.url()).pathname.startsWith('/auth/')) authResponses.push(response.fromServiceWorker()); });
  for (const link of ['/auth/confirm?token_hash=invalid-token&type=email', '/auth/confirm?token_hash=invalid-token&type=recovery', '/auth/callback?code=invalid-code&next=%2Freset-password']) {
    await page.goto(link);
    // Handled by the existing server routes (no auth configured here: a safe error on the login form).
    expect(new URL(page.url()).pathname).toBe('/login');
    expect(new URL(page.url()).searchParams.get('error')).toBe('link');
  }
  expect(authResponses).toEqual([false, false, false]);
  const contents = await cacheContents(page);
  expect(JSON.stringify(contents)).not.toMatch(/token|code=|auth|login/);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('invalid-token');
});

test('the marketing site keeps working with the service worker installed', async ({ page }) => {
  await openControlled(page, '/');
  await expect(page.getByRole('link', { name: 'Subscriptions' }).first()).toBeVisible();
  await page.goto('/subscriptions');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(Object.keys(await cacheContents(page))).toEqual([]);
});
