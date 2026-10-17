import { test, expect } from "@playwright/test";
import { copy } from "../../lib/copy/en";

test("lesson preview plays, pauses, and supports manual steps", async ({
  page,
}) => {
  await page.goto("/coach");
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
  await page.goto("/coach");
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
  await page.goto("/coach");
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

test("module filters and every planned module lead to usable detail pages", async ({
  page,
}, testInfo) => {
  await page.goto("/coach");
  await page
    .getByRole("link", { name: copy.modules.browse, exact: true })
    .click();
  const library = page.locator("#modules");
  await expect(library.locator(".module-item")).toHaveCount(5);
  await library
    .getByRole("button", { name: copy.modules.ready, exact: true })
    .click();
  await expect(library.locator(".module-item")).toHaveCount(1);
  await expect(library.getByRole("heading", { level: 3 })).toHaveText(
    "Tie a tie (four-in-hand knot)",
  );
  await library
    .getByRole("button", { name: copy.modules.soon, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(library.locator(".module-item")).toHaveCount(4);
  const links = await library.locator(".module-link").evaluateAll((items) =>
    items.map((item) => ({
      href: item.getAttribute("href")!,
      title: item.querySelector("h3")!.textContent!,
    })),
  );
  for (const module of links) {
    await library.locator(`a[href="${module.href}"]`).click();
    await expect(
      page.getByRole("heading", { name: module.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(copy.modules.plannedNote, { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".step-list li")).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: copy.intro.start }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (module.href === "/skills/sew-a-button")
      await page.screenshot({
        path: `.impeccable/review/${testInfo.project.name}-module.png`,
        fullPage: true,
        animations: "disabled",
      });
    await page
      .getByRole("link", { name: copy.modules.browse, exact: true })
      .click();
    await library
      .getByRole("button", { name: copy.modules.soon, exact: true })
      .click();
  }
  await library
    .getByRole("button", { name: copy.modules.all, exact: true })
    .click();
  await expect(library.locator(".module-item")).toHaveCount(5);
});
