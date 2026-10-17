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

async function expectSkillCardsPainted(page: Page) {
  const targets = page.locator('#skills .skill-card, #skills .skill-art, #skills .module-explore');
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
  expect(await page.locator('#skills, .mascot, .hero, #hero-preview').evaluateAll(nodes =>
    nodes.flatMap(node => node.getAnimations({ subtree: true })).filter(animation => animation.playState === 'running').length,
  )).toBe(0);
}

test('homepage keeps one learning section and catalog journeys open their matching lessons', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#skills')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'What would you like to learn?', exact: true })).toHaveCount(1);
  await expect(page.locator('#skills .skill-card')).toHaveCount(9);
  await expect(page.locator('.moment-finder, .learning-journeys')).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Choose a situation' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Skills for everyday situations', exact: true })).toHaveCount(0);
  for (const copy of [/A little help for real life/i, /Small steps,\s*real confidence/i, /Everyone starts somewhere/i]) {
    await expect(page.locator('main')).not.toContainText(copy);
  }
  await page.goto('/learn');
  const mappings = [
    { title: 'Ready for your first interview', skills: ['ironing', 'tie', 'button'] },
    { title: 'A little more independent', skills: ['laundry', 'cooking'] },
    { title: 'Find your grooming routine', skills: ['shaving', 'beard'] },
    { title: 'Care for what you own', skills: ['button', 'drill', 'bike'] },
  ];
  await expect(page.locator('.learning-journeys article')).toHaveCount(mappings.length);
  for (const mapping of mappings) {
    const journey = page.locator('.learning-journeys article').filter({ has: page.getByRole('heading', { name: mapping.title, exact: true }) });
    expect(await journey.locator('[data-skill]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-skill')))).toEqual(mapping.skills);
    await expect(journey.getByRole('button')).toHaveCount(mapping.skills.length);
    await journey.getByRole('button').last().focus();
    await page.keyboard.press('Enter');
    const skill = mapping.skills.at(-1)!;
    await expect(page).toHaveURL(new RegExp(`/learn\\?skill=${skill}$`));
    await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill', skill);
    await expect(page.locator('.catalog-player')).toBeFocused();
  }
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
  const personalCare = page.getByRole('group', { name: 'Filter learning modules' }).getByRole('button', { name: /^Personal care/ });
  await personalCare.focus();
  await page.keyboard.press('Space');
  await expect(personalCare).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#skills .skill-card')).toHaveCount(2);
  await expectSkillCardsPainted(page);
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
  // The guide uses the separate coach root layout.
  await page.goto('/coach/guide');
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

test('creative landing, coach and catalog stay within mobile, tablet and desktop viewports', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#skills .skill-card')).toHaveCount(9);
    await expect(page.locator('.moment-finder')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause animations', exact: true })).toBeInViewport();
    await expectNoOverflow(page);
    // Exercise the persisted preference across the coach's separate document root.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
    await page.goto('/coach');
    await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'true');
    await expectNoOverflow(page);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    for (const paused of [false, true, false]) {
      await page.getByRole('button', { name: paused ? 'Pause animations' : 'Resume animations', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-motion-paused', String(paused));
      await expect(page.getByRole('button', { name: paused ? 'Resume animations' : 'Pause animations', exact: true })).toHaveAttribute('aria-pressed', String(paused));
      await expectNoOverflow(page);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/learn');
    await expect(page.locator('.catalog-card')).toHaveCount(9);
    await expectNoOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('homepage skill categories and motion controls expose accessible names and states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const filters = page.getByRole('group', { name: 'Filter learning modules' });
  for (const category of ['All skills', 'Everyday', 'Personal care', 'Make & mend']) {
    const button = filters.getByRole('button', { name: new RegExp(`^${category}`) });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(filters.locator('[aria-pressed="true"]')).toHaveCount(1);
    const result = await new AxeBuilder({ page }).include('#skills').include('.site-motion-control').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    const labels = await new AxeBuilder({ page }).include('#skills').include('.site-motion-control').withRules(['label-content-name-mismatch']).analyze();
    expect(labels.violations).toEqual([]);
  }
});
