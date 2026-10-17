import { test, expect } from "@playwright/test";

test("all nine bundled lessons work without external requests, including every checkpoint", async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  for (const skill of [
    "tie",
    "shaving",
    "beard",
    "ironing",
    "button",
    "drill",
    "laundry",
    "cooking",
    "bike",
  ]) {
    await page.goto(`/#lesson/${skill}`);
    for (let step = 1; step <= 7; step++) {
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuetext",
        `Step ${step} of 7`,
      );
      await expect(
        page.locator(".lesson-illustration svg").first(),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: step === 7 ? "I checked it · Finish" : "I checked it · Next",
        })
        .click();
    }
    await expect(
      page.getByRole("heading", {
        name: "One little skill. A lovely big feeling.",
      }),
    ).toBeVisible();
    await expect(page.getByText("7 self-checked · 0 unresolved")).toBeVisible();
  }
  await page.goto("/#progress");
  await expect(page.locator(".stats strong").first()).toHaveText("9 / 9");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("resume, unresolved checkpoints and lesson reset persist independently", async ({
  page,
}) => {
  await page.goto("/#lesson/tie");
  await page.getByRole("button", { name: "I checked it · Next" }).click();
  await page
    .getByRole("button", { name: "I’m not sure yet — leave this unresolved" })
    .click();
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 3 of 7",
  );
  await page.goto("/#lesson/button");
  await page.getByRole("button", { name: "I checked it · Next" }).click();
  await page.goto("/#lesson/tie");
  await page.getByRole("button", { name: "Reset lesson progress" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep my progress" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 3 of 7",
  );
  for (let step = 3; step <= 7; step++)
    await page
      .getByRole("button", {
        name: step === 7 ? "I checked it · Finish" : "I checked it · Next",
      })
      .click();
  await expect(page.getByText("6 self-checked · 1 unresolved")).toBeVisible();
  await page.getByRole("button", { name: "Practice again" }).click();
  await page.getByRole("button", { name: "Reset lesson", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 1 of 7",
  );
  await page.goto("/#lesson/button");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 2 of 7",
  );
});

test("search, filters, empty state, navigation and motion preference", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator(".skill-card")).toHaveCount(9);
  await page.getByRole("searchbox", { name: "Search skills" }).fill("sewing");
  await expect(page.locator(".skill-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "DIY & Repairs", exact: true })
    .click();
  await expect(page.getByText("No matching skills yet.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".skill-card")).toHaveCount(9);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Pause illustrations" }).check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Pause illustrations" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "My progress", exact: true }).click();
  await expect(
    page.getByText("Your first small win is waiting."),
  ).toBeVisible();
});

test("bundled shell stays usable after going offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Little steps. Look at you go." }),
  ).toBeVisible();
  // Resolve the web Preferences implementation before cutting the network.
  await page.getByRole("button", { name: "Let’s try it" }).click();
  await page.getByRole("button", { name: "I checked it · Next" }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "All skills" }).click();
  await page.getByRole("button", { name: "Start Do your laundry" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 1 of 7",
  );
  await page.getByRole("button", { name: "I checked it · Next" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 2 of 7",
  );
});

for (const width of [320, 390, 768]) {
  test(`screens fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["", "skills", "progress", "settings", "lesson/tie"]) {
      await page.goto(`/#${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Little steps. Look at you go." }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  });
}

test("an unreadable save is left untouched and reported", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Unavailable storage");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Saved progress could not be loaded",
  );
  await expect(
    page.getByText("Your saved progress has been left untouched."),
  ).toBeVisible();
});

test("a failed write is visible while practice can continue", async ({
  page,
}) => {
  await page.goto("/#lesson/tie");
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage full");
    };
  });
  await page.getByRole("button", { name: "I checked it · Next" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Progress could not be saved",
  );
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 2 of 7",
  );
});
