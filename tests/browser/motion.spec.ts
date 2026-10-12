import { test, expect } from "@playwright/test";
import { copy } from "../../lib/copy/en";

test("lesson preview plays, pauses, and supports manual steps", async ({
  page,
}) => {
  await page.goto("/");
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
  await page.locator("#how-title").scrollIntoViewIfNeeded();
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
  await page.goto("/");
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
