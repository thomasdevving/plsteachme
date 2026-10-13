import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.TEST_BROWSER_PATH,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
for (const [name, width, height] of [
  ["phone-375", 375, 812],
  ["phone-414", 414, 896],
  ["desktop", 1440, 1000],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    permissions: ["camera"],
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window.speechSynthesis, "speak", {
      value: (utterance) =>
        queueMicrotask(() => utterance.onend?.(new Event("end"))),
    });
  });
  let checks = 0;
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { mock: true } }),
  );
  await page.route("**/api/verify-step", async (route) => {
    checks++;
    const input = route.request().postDataJSON();
    expect(input.frames).toHaveLength(3);
    expect(input.frames.every((f) => f.startsWith("/9j/"))).toBe(true);
    await route.fulfill({
      json: {
        verdict: checks === 1 ? "fail" : "pass",
        confidence: 0.9,
        errorId: checks === 1 ? "ends_equal" : null,
        observation: "Controlled integration fixture",
        feedback: "Pull the wide end lower.",
        latencyMs: 100,
        model: "mock",
        mock: true,
      },
    });
  });
  await page.goto("http://127.0.0.1:3013/tests/fixtures/index.html");
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "I’m done with this step" }),
  ).toBeEnabled();
  await page.screenshot({
    path: `.impeccable/review/${name}-live-active.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const sizes = await page.getByRole("button").evaluateAll((buttons) =>
    buttons.map((b) => ({
      label: b.textContent,
      height: b.getBoundingClientRect().height,
    })),
  );
  expect(sizes.filter((s) => s.height < 48)).toEqual([]);
  if (process.env.CAPTURE_ONLY === "1") {
    await context.close();
    continue;
  }
  await page.getByRole("button", { name: "I’m done with this step" }).click();
  await expect(page.locator(".session-status")).toContainText(
    "Pull the wide end",
  );
  await expect(
    page.getByRole("button", { name: "I’m done with this step" }),
  ).toBeEnabled();
  for (const title of [
    "Drape the tie",
    "Cross over",
    "Wrap behind",
    "Cross over again",
    "Up through the loop",
    "Down through the front",
    "Tighten and adjust",
  ]) {
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "I’m done with this step" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "I’m done with this step" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "You’ve finished your practice." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This was a simulated session. Your knot has not been assessed.",
    ),
  ).toBeVisible();
  expect(checks).toBe(8);
  expect(errors).toEqual([]);
  console.log(
    `${name}: active screen, correction, capture and seven-step completion passed`,
  );
  await context.close();
}
await browser.close();
