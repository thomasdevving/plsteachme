import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

// Use an isolated preview server with dummy Supabase configuration; every account
// request below is intercepted. These tests never send real registration emails.
test.skip(
  !process.env.TEST_AUTH_PREVIEW,
  "Requires the configured, isolated account preview server.",
);
async function accountFixtures(page: Page) {
  let profile = {
    username: "ada_l",
    firstName: "Ada",
    lastName: "Lovelace",
    hasAvatar: false,
    updatedAt: "2026-10-27T12:00:00Z",
  };
  let photo: Buffer | null = null;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "ada@example.test",
        },
        configured: true,
        trial: null,
      },
    }),
  );
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      profile = {
        ...profile,
        username: body.username.trim().toLowerCase(),
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
      };
    }
    await route.fulfill({ json: { profile } });
  });
  await page.route("**/api/profile/avatar**", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      photo = route.request().postDataBuffer();
      expect(photo?.[0]).toBe(0xff);
      expect(photo?.[1]).toBe(0xd8);
      expect(photo!.includes(Buffer.from("Exif"))).toBe(false);
      profile = {
        ...profile,
        hasAvatar: true,
        updatedAt: new Date().toISOString(),
      };
    } else if (method === "DELETE") profile = { ...profile, hasAvatar: false };
    if (method === "GET")
      return route.fulfill({
        status: photo ? 200 : 404,
        contentType: "image/jpeg",
        body: photo || "",
      });
    await route.fulfill({ json: { profile } });
  });
}
test("registers with identity fields, checks password confirmation, and keeps email confirmation separate from login", async ({
  page,
}) => {
  const attempts: Record<string, unknown>[] = [];
  await page.route("**/api/auth/action", async (route) => {
    attempts.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/signup");
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByLabel("Last name", { exact: true }).fill("Lovelace");
  await page.getByLabel("Username", { exact: true }).fill("ada_l");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("ada@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("my private long password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("another long password");
  await page.getByRole("checkbox", { name: /16 or older/ }).check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".auth-error[role=alert]")).toContainText(
    "passwords do not match",
  );
  expect(attempts).toHaveLength(0);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("my private long password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox." }),
  ).toBeFocused();
  expect(attempts).toEqual([
    expect.objectContaining({
      action: "signup",
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada_l",
      email: "ada@example.test",
      acceptedTerms: true,
      password: "my private long password",
    }),
  ]);
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
});
test("logs in by username and edits a private profile and photo on desktop and mobile", async ({
  page,
}) => {
  await accountFixtures(page);
  await page.route("**/api/auth/action", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.action).toBe("login");
    expect(body.identifier).toBe("ADA_L");
    await route.fulfill(
      body.password === "wrong password"
        ? {
            status: 401,
            json: {
              error:
                "The email, username or password is incorrect. Please try again.",
            },
          }
        : { json: { url: "/account" } },
    );
  });
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("ADA_L");
  await page.getByLabel("Password", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator(".auth-error[role=alert]")).toContainText(
    "incorrect",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("my private long password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/account");
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
    "Ada",
  );
  await page.getByLabel("Last name", { exact: true }).fill("Byron");
  await page.getByLabel("Username", { exact: true }).fill("Ada_Code");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator(".profile-message")).toContainText(
    "profile has been saved",
  );
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "ada_code",
  );
  await page
    .getByLabel("Choose a profile photo", { exact: true })
    .setInputFiles({
      name: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile(
        new URL("../fixtures/exif-frame.jpg", import.meta.url),
      ),
    });
  await expect(
    page.getByRole("img", { name: "Your profile photo" }),
  ).toBeVisible();
  await expect(page.locator(".profile-message")).toContainText(
    "photo has been updated",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 750) {
      const form = await page.locator(".auth-form-area").boundingBox();
      const aside = await page.locator(".auth-welcome").boundingBox();
      expect(aside!.y).toBeGreaterThanOrEqual(form!.y + form!.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `/workspace/artifacts/account-profile-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(
    page.getByRole("img", { name: "Your profile photo" }),
  ).toHaveCount(0);
  await expect(page.locator(".profile-message")).toContainText(
    "photo has been removed",
  );
  await page
    .getByLabel("Choose a profile photo", { exact: true })
    .setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(page.locator(".auth-error[role=alert]")).toContainText(
    "JPG, PNG or WebP",
  );
});
test("requests a password reset for existing email-link accounts without exposing registration status", async ({
  page,
}) => {
  await page.route("**/api/auth/action", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      action: "recover",
      email: "old@example.test",
    });
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/login");
  await page
    .getByRole("link", { name: "Set your password", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("old@example.test");
  await page.getByRole("button", { name: "Send password reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox." }),
  ).toBeFocused();
  await expect(page.getByText(/If an account exists/)).toBeVisible();
});
test("keeps registration and login usable without horizontal overflow on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [
    "/signup",
    "/login",
    "/forgot-password",
    "/reset-password",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
  }
});
