import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// These interactions use the freely available illustrations. External services
// stay unavailable so the design checks never depend on accounts or AI calls.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: false, user: null } }));
  await page.route('**/api/coaching/session', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/platform?*', route => route.fulfill({ json: { available: false, requests: [], lessons: [] } }));
});

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date('2026-10-17T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-17T12:00:01Z'));
}

async function expectNoOverflow(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

async function expectMomentPainted(page: Page) {
  const targets = page.locator('.mf-scene, .mf-plan, .mf-lessons a');
  expect(await targets.count()).toBeGreaterThan(3);
  const painted = await targets.evaluateAll(nodes => nodes.map(node => {
    let opacity = 1;
    let visible = true;
    for (let current: Element | null = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      opacity *= Number(style.opacity);
      visible &&= style.display !== 'none' && style.visibility === 'visible';
    }
    const bounds = node.getBoundingClientRect();
    return { opacity, visible, width: bounds.width, height: bounds.height };
  }));
  for (const target of painted) {
    expect(target.opacity).toBeGreaterThanOrEqual(.99);
    expect(target.visible).toBe(true);
    expect(target.width).toBeGreaterThan(0);
    expect(target.height).toBeGreaterThan(0);
  }
}

async function expectDecorationsStill(page: Page) {
  expect(await page.locator('.moment-finder, .mascot, .hero, #hero-preview').evaluateAll(nodes =>
    nodes.flatMap(node => node.getAnimations({ subtree: true })).filter(animation => animation.playState === 'running').length,
  )).toBe(0);
}

test('moment finder supports keyboard selection and opens the actual matching lesson', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const choices = page.getByRole('tablist', { name: 'Choose a life moment' });
  const tabs = choices.getByRole('tab');
  const panel = page.getByRole('tabpanel');
  await expect(tabs).toHaveCount(3);
  const mappings = [
    { moment: 'first-interview', skills: ['ironing', 'tie', 'button'] },
    { moment: 'living-independently', skills: ['laundry', 'cooking'] },
    { moment: 'care-and-repair', skills: ['button', 'drill', 'bike'] },
  ];
  await tabs.first().focus();
  for (let index = 0; index < mappings.length; index++) {
    if (index) await page.keyboard.press('ArrowRight');
    const selected = choices.locator(`[data-moment="${mappings[index].moment}"]`);
    await expect(selected).toBeFocused();
    await expect(selected).toHaveAttribute('aria-selected', 'true');
    await expect(choices.locator('[aria-selected="true"]')).toHaveCount(1);
    await expect(panel).toHaveAttribute('id', (await selected.getAttribute('aria-controls'))!);
    const destinations = await panel.locator('a[href^="/learn?skill="]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(destinations).toEqual(mappings[index].skills.map(skill => `/learn?skill=${skill}`));
    await expectMomentPainted(page);
    await expectDecorationsStill(page);
  }
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  const lesson = panel.locator('a[href="/learn?skill=button"]');
  await lesson.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/learn\?skill=button$/);
  await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill', 'button');
});

test('global animation pause stops the hero clock and persists without disabling navigation', async ({ page }) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.clock.runFor(800);
  const preview = page.locator('#hero-preview');
  const illustration = preview.locator('.phone-coaching-content .tie-motion');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  const pause = page.getByRole('button', { name: 'Pause animations', exact: true });
  await pause.click();
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
  expect(await page.locator('html').evaluate(node => getComputedStyle(node).scrollBehavior)).toBe('auto');
  await expect(page.getByRole('button', { name: 'Resume animations', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(preview).toHaveAttribute('data-playing', 'false');
  const step = await illustration.getAttribute('data-step');
  await page.clock.runFor(9000);
  await expect(illustration).toHaveAttribute('data-step', step!);
  expect(await page.evaluate(() => localStorage.getItem('plsteach-motion-paused'))).toBe('true');
  const choices = page.getByRole('tablist', { name: 'Choose a life moment' });
  await choices.getByRole('tab').first().focus();
  await page.keyboard.press('End');
  await expect(choices.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true');
  await expectMomentPainted(page);
  await expectDecorationsStill(page);
  await page.reload();
  await page.clock.runFor(100);
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
  await expect(page.locator('#hero-preview')).toHaveAttribute('data-playing', 'false');
  await page.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'false');
  expect(await page.evaluate(() => localStorage.getItem('plsteach-motion-paused'))).toBe('false');
});

test('animation preference survives the separate coach root and controls its preview clock', async ({ page }) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.clock.runFor(800);
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
  // /coach has a different root layout, so this is a real document navigation.
  await page.goto('/coach');
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
  const preview = page.locator('#lesson-preview');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveClass(/is-paused/);
  const counter = preview.locator('.preview-counter');
  const initial = await counter.textContent();
  await page.clock.runFor(10800);
  await expect(counter).toHaveText(initial!);
  expect(await preview.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'false');
  await expect(preview).toHaveClass(/is-playing/);
  await page.clock.runFor(3600);
  await expect(counter).not.toHaveText(initial!);
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  const pausedAgain = await counter.textContent();
  await page.clock.runFor(7200);
  await expect(counter).toHaveText(pausedAgain!);
});

test('reduced motion leaves the hero still while its explicit demonstration control remains usable', async ({ page }) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const preview = page.locator('#hero-preview');
  const illustration = preview.locator('.phone-coaching-content .tie-motion');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-playing', 'false');
  const initial = await illustration.getAttribute('data-step');
  await page.clock.runFor(9000);
  await expect(illustration).toHaveAttribute('data-step', initial!);
  await expectDecorationsStill(page);
  const play = page.getByRole('button', { name: 'Play tie demonstration', exact: true });
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.clock.runFor(3000);
  await expect(illustration).not.toHaveAttribute('data-step', initial!);
  expect(await illustration.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.getByRole('button', { name: 'Pause tie demonstration', exact: true }).click();
  await expect(preview).toHaveAttribute('data-playing', 'false');
});

test('catalog keeps real cards, searchable content and keyboard lesson activation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/learn');
  await expect(page.locator('.catalog-card')).toHaveCount(9);
  expect(await page.locator('.catalog-card-art[data-skill]').evaluateAll(cards => cards.map(card => card.getAttribute('data-skill')).sort())).toEqual(['beard', 'bike', 'button', 'cooking', 'drill', 'ironing', 'laundry', 'shaving', 'tie']);
  const search = page.getByRole('searchbox', { name: 'Search skills', exact: true });
  await search.focus();
  await page.keyboard.type('couscous');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card-art')).toHaveAttribute('data-skill', 'cooking');
  const open = page.locator('.catalog-card').getByRole('button').first();
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/skill=cooking/);
  await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill', 'cooking');
  await expect(page.locator('.catalog-player')).toBeFocused();
  await search.fill('');
  const filters = page.getByRole('group', { name: 'Filter by real-life category' });
  const personal = filters.getByRole('button', { name: 'Personal Care', exact: true });
  await personal.focus();
  await page.keyboard.press('Space');
  await expect(personal).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await expectNoOverflow(page);
});

test('creative landing and catalog stay within mobile, tablet and desktop viewports', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const choices = page.getByRole('tablist', { name: 'Choose a life moment' });
    await choices.getByRole('tab').last().click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause animations', exact: true })).toBeInViewport();
    await expectNoOverflow(page);
    await page.goto('/learn');
    await expect(page.locator('.catalog-card')).toHaveCount(9);
    await expectNoOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('moment finder exposes accessible selected-state and lesson destinations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const finder = page.getByRole('tablist', { name: 'Choose a life moment' });
  const tabs = finder.getByRole('tab');
  for (let index = 0; index < await tabs.count(); index++) {
    await tabs.nth(index).click();
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
    const result = await new AxeBuilder({ page }).include('.moment-finder').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    const labels = await new AxeBuilder({ page }).include('.moment-finder').include('.site-motion-control').withRules(['label-content-name-mismatch']).analyze();
    expect(labels.violations).toEqual([]);
  }
});
