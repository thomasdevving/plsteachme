import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
for (const width of [375, 1440]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 375 ? 812 : 1000 },
    permissions: ["camera"],
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { mock: true } }),
  );
  for (const profile of ["upper-body", "neck", "face", "tabletop", "feet"]) {
    await page.goto(
      `http://127.0.0.1:3013/tests/fixtures/index.html?setup=1&framing=${profile}`,
    );
    await expect(
      page.getByRole("heading", { name: "Let’s find a good view." }),
    ).toBeVisible();
    await expect(
      page.getByText("Preparing the camera and on-device checks…"),
    ).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator(".guide-hand path")).toHaveCount(
      ["upper-body", "tabletop", "feet"].includes(profile) ? 2 : 0,
    );
    if (profile === "tabletop") {
      await expect(page.locator(".setup-checklist")).not.toContainText(
        "shoulder",
      );
      await expect(page.locator(".setup-checklist")).not.toContainText(
        "collar",
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/framing-${profile}-${width}.png`,
      fullPage: true,
    });
  }
  if (process.env.FRAMING_ONLY === "1") { await context.close(); console.log(`${width}px: all five guides passed`); continue; }
  await page.goto("http://localhost:3014/");
  await expect(
    page.getByRole("link", { name: "Try the coach", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.impeccable/review/landing-restored-${width}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Try the coach", exact: true }).click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.locator(".brand-logo")).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(250, 247, 242)");
  await page.screenshot({
    path: `.impeccable/review/coach-restored-${width}.png`,
    fullPage: true,
  });
  await context.close();
  console.log(
    `${width}px: five framing guides and landing-to-coach navigation passed`,
  );
}
await browser.close();
