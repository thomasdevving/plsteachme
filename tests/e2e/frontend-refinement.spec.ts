import { test, expect } from '@playwright/test';

test('learning rail supports arrows, keyboard, category resets and narrow screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const rail = page.getByRole('region', { name: 'Learning modules', exact: true });
    const previous = page.getByRole('button', { name: 'Previous learning modules' });
    const next = page.getByRole('button', { name: 'Next learning modules' });
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await next.click();
    await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(previous).toBeDisabled();
    await rail.focus();
    await page.keyboard.press('ArrowRight');
    await expect(previous).toBeEnabled();
    for (let i = 0; i < 9; i++) {
      const remaining = await rail.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft);
      if (remaining <= 6) break;
      await next.click();
      await expect.poll(() => rail.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft)).toBeLessThan(remaining - 10);
    }
    await expect(next).toBeDisabled();
    await expect(page.getByRole('button', {name:'Explore lesson: Care for your bike'})).toBeInViewport();
    await page.getByRole('button', {name:'Personal care'}).click();
    await expect(page.locator('.skill-card')).toHaveCount(2);
    await expect(previous).toBeDisabled();
    await page.getByRole('button', {name:'All skills'}).click();
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('requested landing copy is removed from the visible page and FAQ schema', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toHaveText('A tutorial shows you, plsteach.me guides you.');
  for (const text of ['Guidance when you need it.', 'No judgment. No rush.', 'Your coach watches with you.', 'When can I learn to shave?']) await expect(page.getByText(text, {exact:true})).toHaveCount(0);
  await expect(page.locator('.coaching-loop,.comparison,.mentor')).toHaveCount(0);
  expect(await page.locator('script[type="application/ld+json"]').textContent()).not.toContain('When can I learn to shave?');
});

test('subscriptions show planned levels with coming-soon pricing and working next steps', async ({page}) => {
  await page.goto('/subscriptions');
  await expect(page).toHaveTitle(/A plan for the way you learn/);
  for (const name of ['Starter','Plus','Teams']) await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.locator('.plan-price p', {hasText:'Coming soon'})).toHaveCount(3);
  await expect(page.getByText('These are our planned subscription levels.',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'Get launch updates'}).first().click();
  await expect(page).toHaveURL(/\/#waitlist$/);
  await expect(page.locator('#waitlist-title')).toBeInViewport();
  await page.goto('/subscriptions');
  await page.getByRole('link',{name:'Explore a pilot'}).click();
  await expect(page).toHaveURL(/\/organizations#pilot$/);
  await expect(page.locator('#pilot')).toBeInViewport();
});

test('mobile navigation reveals subscriptions and closes with Escape or selection', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  const toggle=page.getByLabel('Navigation menu',{exact:true});
  const menu=page.getByRole('navigation',{name:'Mobile navigation'});
  await toggle.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await menu.getByRole('link',{name:'Subscriptions'}).click();
  await expect(page).toHaveURL(/\/subscriptions$/);
  await expect(menu).toBeHidden();
});


test('footer logo follows the wordmark scale and stays clear of links', async ({page}) => {
  for (const width of [375,768,1440]) {
    await page.setViewportSize({width,height:900}); await page.goto('/subscriptions');
    const mark=await page.locator('.footer-wordmark').boundingBox();
    const logo=await page.locator('.footer-wordmark>img').boundingBox();
    const name=await page.locator('.footer-wordmark .brand-teach').boundingBox();
    const links=await page.locator('.footer-bottom').boundingBox();
    expect(logo!.height/name!.height).toBeGreaterThan(.85);
    expect(logo!.height/name!.height).toBeLessThan(1.15);
    expect(links!.y-(mark!.y+mark!.height)).toBeGreaterThanOrEqual(35);
    expect(logo!.x+logo!.width).toBeLessThan(name!.x);
  }
});
