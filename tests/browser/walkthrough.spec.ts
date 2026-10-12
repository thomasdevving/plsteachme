import { test, expect } from "@playwright/test";
import { copy } from "../../lib/copy/en";

test("complete a seven-step lesson with buttons and no camera", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: copy.home.skills }),
  ).toBeVisible();
  await expect(page.locator(".coming-soon").getByText(copy.home.soon, { exact: true })).toBeVisible();
  await page.screenshot({
    path: `.impeccable/review/${testInfo.project.name}-home.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: copy.home.start, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: copy.intro.steps }),
  ).toBeVisible();
  await expect(page.locator(".step-list li")).toHaveCount(7);
  await page.getByRole("link", { name: copy.intro.start, exact: true }).click();
  await expect(
    page.getByRole("button", { name: copy.intake.next }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Never", exact: true }).check();
  await page.getByRole("button", { name: copy.intake.next }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("legend")).toBeFocused();
  await page.getByRole("radio", { name: "Left", exact: true }).check();
  await page.getByRole("button", { name: copy.intake.start }).click();
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: copy.session.repeat, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(copy.session.repeatNote);
  await page
    .getByRole("button", { name: copy.session.demo, exact: true })
    .click();
  await expect(page.locator(".demo-notes")).toBeVisible();
  await page
    .getByRole("button", { name: copy.session.closeDemo, exact: true })
    .click();
  await expect(page.locator(".demo-notes")).not.toBeVisible();
  await expect(page.getByRole("button", { name: copy.session.done })).toBeEnabled();
  await page.screenshot({
    path: `.impeccable/review/${testInfo.project.name}-session.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: copy.session.done }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Cross over", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cross over", exact: true }),
  ).toBeFocused();
  await page.getByRole("link", { name: copy.session.exit }).click();
  await page
    .getByRole("link", { name: new RegExp(copy.home.continue) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cross over", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: copy.common.back, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeFocused();
  const names = [
    "Drape the tie",
    "Cross over",
    "Wrap behind",
    "Cross over again",
    "Up through the loop",
    "Down through the front",
    "Tighten and adjust",
  ];
  for (const title of names) {
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: copy.session.done }),
    ).toBeEnabled();
    await page.getByRole("button", { name: copy.session.done }).focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByText(copy.completion.disclaimer, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("7 steps practiced", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".completion-page h1")).toBeFocused();
  await page.screenshot({
    path: `.impeccable/review/${testInfo.project.name}-completion.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: copy.completion.again }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("bad skill links and broken stored data recover cleanly", async ({
  page,
}) => {
  await page.goto("/session/not-a-skill");
  await expect(
    page.getByRole("heading", { name: copy.notFound.title }),
  ).toBeVisible();
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "plsteach.me:lesson:tie-four-in-hand",
      "broken json",
    ),
  );
  await page.goto("/session/tie-four-in-hand?debug=1");
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".debug-panel pre")).toContainText("walkthrough");
});
