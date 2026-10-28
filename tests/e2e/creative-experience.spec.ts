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
    await page.goto('/learn');
    const journey = page.locator('.learning-journeys article').filter({ has: page.getByRole('heading', { name: mapping.title, exact: true }) });
    expect(await journey.locator('[data-skill]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-skill')))).toEqual(mapping.skills);
    await expect(journey.getByRole('link')).toHaveCount(mapping.skills.length);
    await journey.getByRole('link').last().focus();
    await page.keyboard.press('Enter');
    const skill = mapping.skills.at(-1)!;
    await expect(page).toHaveURL(new RegExp(`/learn/${skill}$`));
    await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill', skill);
    await expect(page.locator('.catalog-grid')).toHaveCount(0);
  }
});

test('animations have no pause controls, and an old stored pause choice is cleared', async ({ page }) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('plsteach-motion-paused', 'true'));
  await page.goto('/');
  await page.clock.runFor(800);
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'false');
  expect(await page.evaluate(() => localStorage.getItem('plsteach-motion-paused'))).toBeNull();
  const preview = page.locator('#hero-preview');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await expect(page.getByRole('button', { name: /pause|resume/i })).toHaveCount(0);
  await page.goto('/coach');
  await expect(page.locator('html')).toHaveAttribute('data-motion-paused', 'false');
  const lesson = page.locator('#lesson-preview');
  await lesson.scrollIntoViewIfNeeded();
  await expect(lesson).toHaveClass(/is-playing/);
  await expect(page.getByRole('button', { name: /pause|resume/i })).toHaveCount(0);
});

test('reduced motion leaves the hero still', async ({ page }) => {
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
  const open = page.locator('.catalog-card').getByRole('link').first();
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/learn\/cooking$/);
  await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill', 'cooking');
  await expect(page.locator('.catalog-grid')).toHaveCount(0);
  await page.getByRole('link',{name:'All lessons',exact:true}).click();
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
    await expectNoOverflow(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/coach');
    await expectNoOverflow(page);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/learn');
    await expect(page.locator('.catalog-card')).toHaveCount(9);
    await expectNoOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('homepage skill categories expose accessible names and states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const filters = page.getByRole('group', { name: 'Filter learning modules' });
  for (const category of ['All skills', 'Everyday', 'Personal care', 'Make & mend']) {
    const button = filters.getByRole('button', { name: new RegExp(`^${category}`) });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(filters.locator('[aria-pressed="true"]')).toHaveCount(1);
    const result = await new AxeBuilder({ page }).include('#skills').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    const labels = await new AxeBuilder({ page }).include('#skills').withRules(['label-content-name-mismatch']).analyze();
    expect(labels.violations).toEqual([]);
  }
});
