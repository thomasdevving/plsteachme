import { test, expect } from "@playwright/test";
import { installActiveTrial } from "./trial-fixture";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test("learning is separate from marketing and the account name updates after editing a profile", async ({
  page,
}) => {
  let username = "ada_l";
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: { id: "11111111-1111-4111-8111-111111111111" },
        trial: null,
      },
    }),
  );
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      json: {
        profile: {
          username,
          firstName: "Ada",
          lastName: "Lovelace",
          hasAvatar: false,
        },
      },
    }),
  );
  await page.route("**/api/progress", (route) =>
    route.fulfill({ json: { progress: [] } }),
  );
  await page.goto("/learn");
  const header = page.locator(".learning-app-header");
  await expect(
    header.getByRole("link", { name: "ada_l", exact: true }),
  ).toHaveAttribute("href", "/account");
  await expect(page.locator(".site-header,.site-footer")).toHaveCount(0);
  await expect(
    header.getByRole("link", {
      name: /Subscriptions|For organizations|What will you learn|Log in/,
    }),
  ).toHaveCount(0);
  username = "ada_new";
  await page.evaluate(() =>
    window.dispatchEvent(new Event("plsteach.profile.updated")),
  );
  await expect(
    header.getByRole("link", { name: "ada_new", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Start Tie a tie", exact: true })
    .click();
  await expect(page).toHaveURL(/\/learn\/tie$/);
  await expect(
    page
      .locator(".lesson-screen-header")
      .getByRole("link", { name: "ada_new", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".catalog-grid,.site-header,.site-footer"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "All lessons", exact: true }).click();
  await expect(page).toHaveURL(/\/learn$/);
});

test("legacy lesson links redirect to dedicated pages", async ({ page }) => {
  await page.goto("/learn?skill=laundry");
  await expect(page).toHaveURL(/\/learn\/laundry$/);
  await expect(page.locator(".lesson-player")).toHaveAttribute(
    "data-skill",
    "laundry",
  );
  await page.goto("/learn/not-a-real-skill");
  await expect(
    page.getByRole("heading", { name: "Lost your way?", exact: true }),
  ).toBeVisible();
});

test("the current step and navigation fit small phones, landscape and desktop without scrolling", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { configured: false, user: null } }),
  );
  await page.route("**/api/coaching/session", (route) =>
    route.fulfill({ json: { available: false } }),
  );
  for (const [width, height] of [
    [1440, 900],
    [375, 667],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const skill of ["tie", "cooking", "shaving"]) {
      await page.goto(`/learn/${skill}`);
      await page.locator(".lesson-copy h2").waitFor();
      const fits = await page.evaluate(() => {
        const main = document.querySelector(".lesson-screen-main")!;
        const controls = document
          .querySelector(".lesson-controls")!
          .getBoundingClientRect();
        return (
          document.documentElement.scrollHeight <= innerHeight + 1 &&
          document.documentElement.scrollWidth <= innerWidth &&
          main.scrollHeight <= main.clientHeight + 2 &&
          controls.bottom <= innerHeight
        );
      });
      expect(fits, `${skill} at ${width}×${height}`).toBe(true);
    }
  }
});

test("leaving the camera view stops tracks and cancels automatic checks and advancement", async ({
  page,
}) => {
  await installActiveTrial(page);
  await page.route("**/api/coaching/session", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { available: true }
          : { accepted: true },
    }),
  );
  let calls = 0;
  await page.route("**/api/coaching/check", (route) => {
    calls++;
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        skill: body.skill,
        step: body.step,
        feedback: {
          status: "looks_right",
          confidence: "high",
          observation: "The wide end is longer.",
          guidance: "Keep it flat.",
        },
      },
    });
  });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as any).lessonTracks = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as any).lessonTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto("/learn/tie");
  await page.getByRole("button", { name: "Coach", exact: true }).click();
  const coach = page.locator(".camera-coach");
  await coach
    .getByRole("checkbox", { name: "I am 16 or older.", exact: true })
    .check();
  await coach
    .getByRole("checkbox", { name: "I agree to automatic image checks" })
    .check();
  await coach.getByRole("button", { name: "Start camera coaching" }).click();
  await coach.getByRole("button", { name: "Skip this step" }).click();
  await expect(
    coach.getByRole("button", { name: "Stay on this step" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Prepare", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).lessonTracks.every(
          (track: MediaStreamTrack) => track.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
  const stoppedAt = calls;
  await page.clock.install();
  await page.clock.runFor(10000);
  expect(calls).toBe(stoppedAt);
  await expect(page.locator(".lesson-step")).toHaveText("Step 1 of 7");
  await page.getByRole("button", { name: "Coach", exact: true }).click();
  await expect(
    coach.getByRole("button", { name: "Start camera coaching" }),
  ).toBeVisible();
});
