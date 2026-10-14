import { test, expect } from "@playwright/test";

async function freezeClock(page: import("@playwright/test").Page) {
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-14T12:00:01Z"));
}

test("hero uses the requested copy without extra pickers or mission sections", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A tutorial shows you, plsteach.me guides you.",
  );
  await expect(page.locator(".hero-description")).toContainText(
    "A tie. A shirt. A loose button.",
  );
  await expect(page.locator(".hero-description .hero-emphasis")).toHaveText(
    "Not everyone had someone to ask.",
  );
  for (const text of [
    "Pick a skill. Try a step.",
    "Some things were never shown to you.",
    "Nobody should have to figure everything out alone.",
  ])
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".hero-module-options,.hero-modules,.problem,.coach-controls"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Previous example step" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next step", exact: true }),
  ).toHaveCount(0);
});

test("phone advances every three seconds through seven distinct tie states and loops", async ({
  page,
}) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const figure = page.locator("#hero-preview"),
    art = page.locator(".tie-motion");
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute("data-playing", "true");
  await expect(art).toHaveAttribute("data-step", "1");
  const shapes = [await page.locator(".tie-wide-end").getAttribute("d")];
  await page.clock.runFor(2999);
  await expect(art).toHaveAttribute("data-step", "1");
  await page.clock.runFor(1);
  await expect(art).toHaveAttribute("data-step", "2");
  for (let step = 2; step <= 7; step++) {
    await expect(art).toHaveAttribute("data-step", String(step));
    await expect(art).toHaveAccessibleName(new RegExp(`^Step ${step}:`));
    await expect(page.locator(".phone-progress")).toHaveAttribute(
      "aria-valuenow",
      String(step),
    );
    shapes.push(await page.locator(".tie-wide-end").getAttribute("d"));
    await page.clock.runFor(3000);
  }
  expect(new Set(shapes).size).toBe(7);
  await expect(art).toHaveAttribute("data-step", "1");
  expect(await art.evaluate(el => el.getAnimations({subtree:true}).length)).toBe(0);
  expect(await page.locator('.tie-wide-end').getAttribute('d')).toBe(shapes[0]);
});

test("pause stops the clock and fabric motion; offscreen and hidden tabs stop advancement", async ({
  page,
}) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const figure = page.locator("#hero-preview"),
    art = page.locator(".tie-motion");
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(3000);
  await expect(art).toHaveAttribute("data-step", "2");
  await page.getByRole("button", { name: "Pause tie demonstration" }).click();
  await page.clock.runFor(6000);
  await expect(art).toHaveAttribute("data-step", "2");
  expect(
    await art.evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .every((animation) => animation.playState !== "running"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Play tie demonstration" }).click();
  await page.clock.runFor(3000);
  await expect(art).toHaveAttribute("data-step", "3");
  await page.locator("#skills").scrollIntoViewIfNeeded();
  await expect(figure).not.toBeInViewport();
  await page.clock.runFor(16);
  const offscreen = await art.getAttribute("data-step");
  await page.clock.runFor(9000);
  await expect(art).toHaveAttribute("data-step", offscreen!);
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toBeInViewport();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(6000);
  await expect(art).toHaveAttribute("data-step", offscreen!);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(3000);
  await expect(art).not.toHaveAttribute("data-step", offscreen!);
});

test("reduced motion starts static and explicit play changes steps without fabric morphs", async ({
  page,
}) => {
  await freezeClock(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const art = page.locator(".tie-motion");
  await page.locator("#hero-preview").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Play tie demonstration" }),
  ).toBeVisible();
  await page.clock.runFor(9000);
  await expect(art).toHaveAttribute("data-step", "1");
  await page.getByRole("button", { name: "Play tie demonstration" }).click();
  await page.clock.runFor(3000);
  await expect(art).toHaveAttribute("data-step", "2");
  expect(
    await art.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
});
