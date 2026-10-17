import { test, expect } from "@playwright/test";
import { copy } from "../../lib/copy/en";
import AxeBuilder from '@axe-core/playwright';

test('module library filters working lessons and keeps the guide separate', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/coach');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your modules.');
  const library = page.getByRole('region', { name: 'Module library' });
  await expect(library.locator('.module-item')).toHaveCount(9);
  await expect(page.locator('#lesson-preview, .how-section, .coming-soon')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Guide', exact: true })).toHaveAttribute('href', '/coach/guide');
  const links = await library.locator('.module-link').evaluateAll(items => items.map(item => item.getAttribute('href')!));
  expect(new Set(links).size).toBe(9);
  await library.getByRole('button', { name: 'Personal care', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(library.locator('.module-item')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search modules' }).fill('beard');
  await expect(library.getByRole('link')).toHaveCount(1);
  await expect(library.getByRole('link')).toHaveAccessibleName('Trim your beard');
  await page.getByRole('searchbox', { name: 'Search modules' }).fill('no-matching-skill');
  await expect(page.getByRole('heading', { name: 'No modules found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all modules' }).click();
  await expect(library.locator('.module-item')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations.map(item => item.id)).toEqual([]);
  await page.screenshot({ path: `.impeccable/review/${testInfo.project.name}-coach-library.png`, fullPage: true, animations: 'disabled' });
  for (const href of links) {
    await page.goto(href);
    if (href.includes('/coach/skills/')) await expect(page.locator('.step-list li')).toHaveCount(7);
    else await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill', new URL(href, 'https://plsteach.me').searchParams.get('skill')!);
  }
  await page.goto('/coach/guide');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How coaching works.');
  await expect(page.locator('#lesson-preview')).toBeVisible();
  await page.getByRole('link', { name: 'Modules', exact: true }).click();
  await expect(page).toHaveURL(/\/coach$/);
});

test("lesson preview plays, pauses, and supports manual steps", async ({
  page,
}) => {
  await page.goto("/coach/guide");
  const preview = page.locator(".skill-preview");
  await page.getByRole("button", { name: copy.motion.pause }).click();
  await expect(preview).toHaveClass(/is-paused/);
  await page.getByRole("button", { name: copy.motion.next }).click();
  await expect(preview.locator(".preview-step-title")).toHaveText("Cross over");
  await page.getByRole("button", { name: copy.motion.previous }).click();
  await expect(preview.locator(".preview-step-title")).toHaveText(
    "Drape the tie",
  );
  await page.getByRole("button", { name: copy.motion.play }).click();
  await expect(preview.locator(".preview-step-title")).toHaveText(
    "Cross over",
    { timeout: 7000 },
  );
  // The shorter guide can leave part of the preview visible beside the next
  // heading. Move far enough down to exercise actual offscreen suspension.
  await page.locator("#future-title").scrollIntoViewIfNeeded();
  await expect(preview).toHaveClass(/is-paused/);
  await page.locator(".how-stage").nth(2).click();
  await expect(page.locator(".how-visual-caption strong")).toHaveText(
    copy.how.stages[2].caption,
  );
  await expect(page.locator(".how-stage").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: copy.how.futureTitle }),
  ).toBeVisible();
});

test("reduced motion keeps diagrams complete and manual preview controls usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/coach/guide");
  const preview = page.locator(".skill-preview");
  await expect(preview).toHaveClass(/is-static/);
  await expect(
    page.getByRole("button", { name: copy.motion.play }),
  ).toBeDisabled();
  await page.getByRole("button", { name: copy.motion.next }).click();
  await expect(preview.locator(".preview-step-title")).toHaveText("Cross over");
  const style = await preview
    .locator(".incoming .tie-wide")
    .first()
    .evaluate((element) => ({
      animation: getComputedStyle(element).animationName,
      clip: getComputedStyle(element).clipPath,
    }));
  expect(style).toEqual({ animation: "none", clip: "none" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("headline dashes select the matching diagram and stay in sync with playback", async ({
  page,
}) => {
  await page.goto("/coach/guide");
  const navigation = page.getByRole("group", { name: copy.motion.choose });
  const preview = page.locator(".skill-preview");
  await expect(navigation.getByRole("button")).toHaveCount(7);
  const fourth = navigation.getByRole("button", {
    name: copy.motion.select(4, "Cross over again"),
    exact: true,
  });
  await fourth.focus();
  await page.keyboard.press("Enter");
  await expect(fourth).toHaveAttribute("aria-pressed", "true");
  await expect(preview.locator(".preview-step-title")).toHaveText(
    "Cross over again",
  );
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveClass(/is-paused/);
  await page.getByRole("button", { name: copy.motion.next }).click();
  await expect(navigation.getByRole("button").nth(4)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: copy.motion.play }).click();
  await expect(navigation.getByRole("button").nth(5)).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 7000 },
  );
  const sizes = await navigation.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => ({
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
    })),
  );
  expect(sizes.every((size) => size.width >= 48 && size.height >= 48)).toBe(
    true,
  );
  const bounds = await navigation.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
  }));
  expect(bounds.left).toBeGreaterThanOrEqual(16);
  expect(bounds.right).toBeLessThanOrEqual(
    (page.viewportSize()?.width ?? 375) - 16,
  );
});
