import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Uses only its own disposable account. No email, AI call or trial claim.
// Do not enable tracing: the confirmation URL and cookies are credentials.
const target = new URL(process.argv[2]);
assert(target.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(target.hostname));
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(25_000) }) },
});
let fixture;
let browser;
let current = 'Create disposable account';
let count = 0;
const check = result => { assert.equal(result.error, null); return result.data; };
const pass = () => { console.log(`PASS ${current}`); count++; };
try {
  fixture = check(await admin.auth.admin.createUser({
    email: `plsteach-navigation-${randomUUID()}@example.com`, email_confirm: true,
  })).user;
  const token = check(await admin.auth.admin.generateLink({ type: 'magiclink', email: fixture.email }));
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: target.origin, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  current = 'Verified account opens with an unused free session';
  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(token.properties.hashed_token)}`);
  await expect(page).toHaveURL(`${target.origin}/account`);
  await expect(page.getByRole('heading', { name: 'One free session, just for you.' })).toBeVisible();
  pass();

  current = 'Returning home and reloading retains the signed-in header';
  await page.getByRole('link', { name: 'plsteach.me home', exact: true }).click();
  await expect(page).toHaveURL(`${target.origin}/`);
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText('My account');
  await page.reload();
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText('My account');
  await mkdir('.impeccable/review', { recursive: true });
  await page.screenshot({ path: '.impeccable/review/signed-in-home.png' });
  pass();

  current = 'Login and signup recognize an existing session and honor safe destinations';
  await page.goto('/login');
  await expect(page).toHaveURL(`${target.origin}/account`);
  await page.goto('/signup?next=%2Fcoach');
  await expect(page).toHaveURL(`${target.origin}/coach`);
  await page.goto('/login?next=https%3A%2F%2Fexample.com');
  await expect(page).toHaveURL(`${target.origin}/account`);
  pass();

  current = 'Phone navigation and browser back keep the same account';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText('My account');
  await page.getByLabel('Navigation menu', { exact: true }).click();
  const mobile = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobile.getByRole('link', { name: 'My account' })).toBeVisible();
  await expect(mobile.getByRole('link', { name: 'Log in' })).toHaveCount(0);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.getByRole('link', { name: 'My account' }).click();
  await expect(page.getByRole('heading', { name: 'One free session, just for you.' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText('My account');
  pass();

  current = 'An expiring session refreshes from home without losing the account';
  const cookies = (await context.cookies()).filter(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }));
  assert(cookies.length);
  const serialized = cookies.map(cookie => cookie.value).join('');
  assert(serialized.startsWith('base64-'));
  const session = JSON.parse(Buffer.from(serialized.slice(7), 'base64url').toString());
  session.expires_at = 1;
  const expired = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  // Recreate only this fixture's cookie chunks, without storing them on disk.
  await context.clearCookies({ name: /^sb-.*-auth-token(?:\.\d+)?$/ });
  const baseName = cookies[0].name.replace(/\.\d+$/, '');
  const chunkSize = 3000;
  const parts = Math.ceil(expired.length / chunkSize);
  await context.addCookies(Array.from({ length: parts }, (_, i) => ({
    ...cookies[0], name: parts === 1 ? baseName : `${baseName}.${i}`,
    value: expired.slice(i * chunkSize, (i + 1) * chunkSize),
  })));
  await page.reload();
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText('My account');
  const response = await context.request.get('/api/auth/session');
  const account = await response.json();
  assert.equal(account.user.id, fixture.id);
  assert.equal(account.trial, null);
  const renewedCookies = (await context.cookies()).filter(cookie => cookie.name.startsWith(baseName)).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }));
  const renewed = JSON.parse(Buffer.from(renewedCookies.map(cookie => cookie.value).join('').slice(7), 'base64url').toString());
  assert(renewed.expires_at > Date.now() / 1000);
  pass();

  current = 'Explicit sign-out ends the session and home reflects it';
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(`${target.origin}/login`);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByText(/sign-in (?:are|is) coming soon/)).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('.nav-actions > a[href="/login"]')).toHaveText('Log in');
  pass();
} catch {
  console.error(`FAIL ${current}. Credentials and raw responses are intentionally omitted.`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (fixture) {
    const { error } = await admin.auth.admin.deleteUser(fixture.id);
    if (error) { console.error('Disposable fixture cleanup needs attention.'); process.exitCode = 1; }
    else console.log('Disposable account removed.');
  }
  console.log(`${count} connected navigation checks passed. No email, AI or free-session usage.`);
}
