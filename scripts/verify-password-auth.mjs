import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

// Disposable fixtures only. Never enable traces, log response bodies, or print tokens/passwords.
// --smtp sends only to Resend's documented delivery simulator, never a person's inbox.
const target = new URL(process.argv[2]);
const smtp = process.argv.includes("--smtp");
const recoveryMail = process.argv.includes("--smtp-recovery");
assert(
  target.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(target.hostname),
);
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(25000) }),
    },
  },
);
const fixtures = [];
let browser;
let page;
let lastAuthStatus;
const authActions = [];
const browserErrors = [];
let count = 0;
let smtpFixtureStarted = false;
let current = "Initialize password flow";
const checked = (result) => {
  assert.equal(result.error, null);
  return result.data;
};
const pass = () => {
  console.log(`PASS ${current}`);
  count++;
};
const email =
  smtp || recoveryMail
    ? "delivered+plsteach-auth-check@resend.dev"
    : `delivered+plsteach-${randomUUID()}@resend.dev`;
const initialPassword = `Practice-${randomUUID()}!`;
const changedPassword = `Learn-${randomUUID()}!`;
const recoveredPassword = `Recover-${randomUUID()}!`;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: target.origin,
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/auth/action") &&
      request.method() === "POST"
    ) {
      try {
        authActions.push(request.postDataJSON().action);
      } catch {}
    }
  });
  page.on("pageerror", (error) =>
    browserErrors.push(
      error.message.split("\n")[0].replace(/https?:\/\/[^\s]+/g, "[url]"),
    ),
  );
  page.on("response", (response) => {
    if (response.url().endsWith("/api/auth/action"))
      lastAuthStatus = response.status();
  });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  const action = (data, origin = target.origin) =>
    context.request.post("/api/auth/action", { headers: { origin }, data });
  const passwordFields = async (password) => {
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
  };
  const login = async (password) => {
    await page.goto("/login");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  };
  current =
    "Signup and recovery screens fit phones and expose accessible controls";
  await mkdir(".impeccable/review", { recursive: true });
  for (const path of ["/signup", "/login", "/forgot-password"]) {
    await page.goto(path);
    await page.setViewportSize({ width: 375, height: 812 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.equal(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations.length,
      0,
    );
    await expect(
      page.getByText(/Continue with Google|Continue with Apple/),
    ).toHaveCount(0);
    if (path === "/signup")
      await page.screenshot({
        path: ".impeccable/review/password-signup-mobile.png",
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/signup");
  await page.screenshot({
    path: ".impeccable/review/password-signup.png",
    fullPage: true,
  });
  pass();
  current = smtp
    ? "Real signup accepts a password and sends confirmation through SMTP"
    : "Create an unconfirmed disposable password account";
  if (smtp) {
    const existing = checked(
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ).users.find((user) => user.email === email);
    assert(
      !existing,
      "SMTP fixture already exists; refusing to use an existing account.",
    );
    smtpFixtureStarted = true;
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await passwordFields(initialPassword);
    const signupResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/action") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await signupResponse;
    // Recover the fixture ID even if the UI assertion fails after creation.
    const users = checked(
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ).users;
    const user = users.find((user) => user.email === email);
    if (user) fixtures.push(user.id);
    await expect(
      page.getByRole("heading", { name: "Check your inbox." }),
    ).toBeVisible();
    assert(user);
    assert(!user.email_confirmed_at);
  } else {
    fixtures.push(
      checked(
        await admin.auth.admin.createUser({
          email,
          password: initialPassword,
          email_confirm: false,
        }),
      ).user.id,
    );
  }
  const fixtureId = fixtures[0];
  pass();
  current = "Unconfirmed accounts cannot log in and can request confirmation";
  await login(initialPassword);
  await expect(page.locator(".auth-error")).toContainText("Confirm your email");
  await expect(
    page.getByRole("button", { name: "Resend confirmation email" }),
  ).toBeVisible();
  assert.equal(
    (await (await context.request.get("/api/auth/session")).json()).user,
    null,
  );
  pass();
  current =
    "Email confirmation opens the existing account with one unused free session";
  const signup = checked(
    await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: initialPassword,
    }),
  );
  assert.equal(signup.user.id, fixtureId);
  await page.goto(
    `/auth/confirm?token_hash=${encodeURIComponent(signup.properties.hashed_token)}`,
  );
  await expect(page).toHaveURL(`${target.origin}/account`);
  await expect(
    page.getByRole("heading", { name: "One free session, just for you." }),
  ).toBeVisible();
  pass();
  current =
    "Wrong passwords fail; correct passwords log in and survive returning home";
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(`${target.origin}/login`);
  await login("wrong password");
  await expect(page.locator(".auth-error")).toContainText(
    "Email or password is incorrect",
  );
  await login(initialPassword);
  await expect(page).toHaveURL(`${target.origin}/account`);
  const cookies = (await context.cookies()).filter((c) =>
    /^sb-.*auth-token/.test(c.name),
  );
  assert(cookies.length);
  assert(cookies.every((c) => c.httpOnly && c.sameSite === "Lax"));
  if (target.protocol === "https:") assert(cookies.every((c) => c.secure));
  await page.getByRole("link", { name: "Back to home", exact: true }).click();
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText(
    "My account",
  );
  await page.reload();
  await expect(page.locator('.nav-actions > a[href="/account"]')).toHaveText(
    "My account",
  );
  pass();
  current = "Changing a password preserves the account and its unused session";
  await page.goto("/account");
  await page.getByRole("link", { name: "Set or change password" }).click();
  await passwordFields(changedPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(
    page.getByRole("heading", { name: "Password saved." }),
  ).toBeVisible();
  let account = await (await context.request.get("/api/auth/session")).json();
  assert.equal(account.user.id, fixtureId);
  assert.equal(account.trial, null);
  await action({ action: "signout" });
  assert.equal(
    (
      await action({ action: "login", email, password: initialPassword })
    ).status(),
    401,
  );
  assert.equal(
    (
      await action({ action: "login", email, password: changedPassword })
    ).status(),
    200,
  );
  pass();
  current =
    "Recovery opens password setup and recovery tokens cannot be reused";
  await action({ action: "signout" });
  if (smtp || recoveryMail) {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox." }),
    ).toBeVisible();
  }
  const recovery = checked(
    await admin.auth.admin.generateLink({ type: "recovery", email }),
  );
  const recoveryPath = `/auth/confirm?token_hash=${encodeURIComponent(recovery.properties.hashed_token)}&type=recovery`;
  await page.goto(recoveryPath);
  await expect(page).toHaveURL(`${target.origin}/account/password`);
  await passwordFields(recoveredPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(
    page.getByRole("heading", { name: "Password saved." }),
  ).toBeVisible();
  const outsider = await browser.newContext({ baseURL: target.origin });
  const outsiderPage = await outsider.newPage();
  await outsiderPage.goto(recoveryPath);
  await expect(outsiderPage).toHaveURL(
    `${target.origin}/forgot-password?error=link`,
  );
  await expect(outsiderPage.locator(".auth-error")).toContainText("expired");
  await outsider.close();
  await action({ action: "signout" });
  await login(recoveredPassword);
  await expect(page).toHaveURL(`${target.origin}/account`);
  account = await (await context.request.get("/api/auth/session")).json();
  assert.equal(account.user.id, fixtureId);
  assert.equal(account.trial, null);
  pass();
  current =
    "Anonymous, cross-site and discontinued social/passwordless actions are rejected";
  assert.equal(
    (
      await action(
        { action: "update-password", password: initialPassword },
        "https://other.example",
      )
    ).status(),
    403,
  );
  await action({ action: "signout" });
  assert.equal(
    (
      await action({
        action: "update-password",
        password: initialPassword,
        user_id: fixtureId,
      })
    ).status(),
    401,
  );
  for (const discontinued of ["email", "oauth"])
    assert.equal(
      (
        await action({
          action: discontinued,
          email,
          signup: true,
          provider: "google",
        })
      ).status(),
      400,
    );
  await page.goto("/account/password");
  await expect(page).toHaveURL(`${target.origin}/forgot-password`);
  pass();
  current =
    "Existing passwordless accounts can set a password without creating a new account";
  const legacy = checked(
    await admin.auth.admin.createUser({
      email: `plsteach-legacy-${randomUUID()}@example.com`,
      email_confirm: true,
    }),
  ).user;
  fixtures.push(legacy.id);
  const legacyToken = checked(
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: legacy.email,
    }),
  );
  await page.goto(
    `/auth/confirm?token_hash=${encodeURIComponent(legacyToken.properties.hashed_token)}`,
  );
  await page.goto("/account/password");
  await passwordFields(changedPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(
    page.getByRole("heading", { name: "Password saved." }),
  ).toBeVisible();
  await action({ action: "signout" });
  assert.equal(
    (
      await action({
        action: "login",
        email: legacy.email,
        password: changedPassword,
      })
    ).status(),
    200,
  );
  account = await (await context.request.get("/api/auth/session")).json();
  assert.equal(account.user.id, legacy.id);
  assert.equal(account.trial, null);
  pass();
} catch (error) {
  console.error(`FAIL ${current}. Credentials and raw responses are omitted.`);
  // Safe classifier only; Playwright errors may embed credentials or DOM values.
  if (page) {
    console.error(
      "Visible form error:",
      await page.locator(".auth-error").allTextContents(),
    );
    console.error("Page heading:", await page.locator("h1").allTextContents());
    console.error("Last auth HTTP status:", lastAuthStatus);
    console.error("Actions:", authActions);
    console.error("Browser errors:", browserErrors);
    console.error(
      "URL contains password query:",
      new URL(page.url()).searchParams.has("password"),
    );
    console.error(
      "Form validity:",
      await page
        .locator("input")
        .evaluateAll((inputs) =>
          inputs.map((input) => ({
            name: input.name,
            length: input.value.length,
            valid: input.checkValidity(),
          })),
        ),
    );
  }
  console.error(`Failure type: ${error?.name || "Error"}`);
  console.error(
    String(error?.message || "")
      .split("\n")[0]
      .replace(/token_hash=[^&\s]+/g, "token_hash=[redacted]"),
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (smtpFixtureStarted && !fixtures.length) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) {
      console.error("Could not verify signup fixture cleanup.");
      process.exitCode = 1;
    } else {
      const user = data.users.find((user) => user.email === email);
      if (user) fixtures.push(user.id);
    }
  }
  for (const id of fixtures) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.error("Disposable fixture cleanup needs attention.");
      process.exitCode = 1;
    }
  }
  console.log(
    `${count} connected password checks passed; ${fixtures.length} disposable fixtures cleaned up. No AI or free-session usage.`,
  );
}
