import { expect, test } from "@playwright/test";
import { cacheContents, openControlled } from "./helpers";

test("cancelling the first download also cancels library preparation", async ({
  context,
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let preparing = false;
  await context.route("**/learn/offline", async (route) => {
    if (route.request().resourceType() !== "fetch") return route.continue();
    preparing = true;
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await openControlled(page, "/learn/tie");
    await page.getByRole("button", { name: "Prepare", exact: true }).click();
    await page
      .getByRole("button", { name: "Download for offline", exact: true })
      .click();
    await expect.poll(() => preparing).toBe(true);
    await page
      .getByRole("button", { name: "Cancel download", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Download for offline", exact: true }),
    ).toBeVisible();
    release();
    expect(
      Object.keys(await cacheContents(page)).filter((name) =>
        /:tie:|:shell:/.test(name),
      ),
    ).toEqual([]);
    await expect(page.getByText("Ready without internet")).toHaveCount(0);
    // The same first download can immediately be tried again.
    await page
      .getByRole("button", { name: "Download for offline", exact: true })
      .click();
    await expect(page.getByText("Ready without internet")).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    release();
  }
});

test("two lessons share library preparation and cancelling one keeps the other running", async ({
  context,
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let preparing = false;
  await context.route("**/learn/offline", async (route) => {
    if (route.request().resourceType() !== "fetch") return route.continue();
    preparing = true;
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await openControlled(page, "/learn/offline");
    const tie = page
      .locator(".offline-row")
      .filter({
        has: page.getByRole("heading", { name: "Tie a tie", exact: true }),
      });
    const shaving = page
      .locator(".offline-row")
      .filter({
        has: page.getByRole("heading", { name: "Shave", exact: true }),
      });
    await tie
      .getByRole("button", { name: "Download for offline", exact: true })
      .click();
    await expect.poll(() => preparing).toBe(true);
    await shaving
      .getByRole("button", { name: "Download for offline", exact: true })
      .click();
    await expect(
      shaving.getByRole("button", { name: "Cancel download", exact: true }),
    ).toBeVisible();
    await tie
      .getByRole("button", { name: "Cancel download", exact: true })
      .click();
    await expect(
      tie.getByRole("button", { name: "Download for offline", exact: true }),
    ).toBeVisible();
    release();
    await expect(shaving.getByText("Ready without internet")).toBeVisible({
      timeout: 30_000,
    });
    const names = Object.keys(await cacheContents(page));
    expect(names.some((name) => name.includes(":shaving:"))).toBe(true);
    expect(names.some((name) => name.includes(":tie:"))).toBe(false);
  } finally {
    release();
  }
});
