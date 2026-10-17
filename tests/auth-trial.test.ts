import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  signup: vi.fn(),
  login: vi.fn(),
  reset: vi.fn(),
  resend: vi.fn(),
  update: vi.fn(),
  getUser: vi.fn(),
  signout: vi.fn(),
  enabled: true,
}));
vi.mock("@/lib/auth/config", () => ({
  authConfig: () => ({ enabled: mocks.enabled, google: true, apple: true }),
}));
vi.mock("@/lib/auth/server", () => ({
  authenticatedUser: mocks.user,
  authClient: async () => ({
    auth: {
      signUp: mocks.signup,
      signInWithPassword: mocks.login,
      resetPasswordForEmail: mocks.reset,
      resend: mocks.resend,
      updateUser: mocks.update,
      getUser: mocks.getUser,
      signOut: mocks.signout,
    },
  }),
}));
vi.mock("@/lib/storage", () => ({
  db: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
  }),
}));
import { safeNext } from "../lib/auth/redirect";
import { requireTrial } from "../lib/auth/trial";
import {
  builtinTrialId,
  publishedTrialId,
  trialResumeHref,
} from "../lib/auth/trial-reference";
import { POST as trialAction } from "../app/api/trial/route";
import { POST as authAction } from "../app/api/auth/action/route";
const trial = {
  id: "4db53adb-4962-4d42-ae3b-e5b69528ac63",
  skill_id: "tie-four-in-hand",
  completed_at: null,
  completed_steps: 0,
  total_steps: 7,
};
function req(body = {}, extra: Record<string, string> = {}) {
  return new Request("https://plsteach.me/api/trial", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://plsteach.me",
      "x-coaching-session": trial.id,
      ...extra,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.user.mockResolvedValue({ id: "verified-user" });
  mocks.maybeSingle.mockResolvedValue({ data: trial, error: null });
  mocks.rpc.mockResolvedValue({ data: trial, error: null });
  for (const method of [
    mocks.signup,
    mocks.reset,
    mocks.resend,
    mocks.update,
    mocks.signout,
  ])
    method.mockResolvedValue({ error: null });
  mocks.login.mockResolvedValue({ data: { session: {} }, error: null });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "verified-user" } },
    error: null,
  });
});
describe("one free session authorization", () => {
  it("does not consume a trial when OpenAI is absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(
      (await trialAction(req({ action: "start", skillId: trial.skill_id })))
        .status,
    ).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects anonymous Supabase accounts", async () => {
    mocks.user.mockResolvedValue({ id: "guest", is_anonymous: true });
    expect((await requireTrial(req(), trial.skill_id))?.status).toBe(401);
    expect(
      (await trialAction(req({ action: "start", skillId: trial.skill_id })))
        .status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses the same durable trial for new lessons and preserves the previous chosen skill", async () => {
    expect(
      (await trialAction(req({ action: "start", skillId: "builtin:laundry" })))
        .status,
    ).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_coaching_trial", {
      p_user_id: "verified-user",
      p_skill_id: "builtin:laundry",
      p_total_steps: 7,
    });
    expect(builtinTrialId("tie")).toBe(trial.skill_id);
    expect(
      (await trialAction(req({ action: "start", skillId: "builtin:tie" })))
        .status,
    ).toBe(404);
  });
  it("requires an active matching account session even for the consent endpoint", async () => {
    expect(await requireTrial(req())).toBeNull();
    mocks.maybeSingle.mockResolvedValue({
      data: { ...trial, completed_at: "2026-10-17" },
      error: null,
    });
    expect((await requireTrial(req()))?.status).toBe(403);
  });
  it("resumes new lessons without creating a separate account entitlement", () => {
    expect(trialResumeHref("builtin:laundry")).toBe("/learn?skill=laundry");
    const id = "11111111-1111-4111-8111-111111111111";
    expect(trialResumeHref(publishedTrialId(id, 2))).toBe(
      `/learn?lesson=${id}`,
    );
    expect(trialResumeHref(trial.skill_id)).toBe(
      "/coach/session/tie-four-in-hand",
    );
  });
  it("rejects anonymous access before calling storage", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await requireTrial(req(), trial.skill_id))?.status).toBe(401);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });
  it.each([
    { completed_at: "2026-10-17" },
    { skill_id: "different-skill" },
    { id: "someone-elses-session" },
  ])(
    "rejects a completed, different-skill or different-account session %j",
    async (patch) => {
      mocks.maybeSingle.mockResolvedValue({
        data: { ...trial, ...patch },
        error: null,
      });
      expect((await requireTrial(req(), trial.skill_id))?.status).toBe(403);
    },
  );
  it("fails closed when configuration or storage is unavailable", async () => {
    mocks.enabled = false;
    expect((await requireTrial(req(), trial.skill_id))?.status).toBe(503);
    mocks.enabled = true;
    mocks.maybeSingle.mockResolvedValue({ data: null, error: {} });
    expect((await requireTrial(req(), trial.skill_id))?.status).toBe(503);
  });
  it("allows only the active account session", async () => {
    expect(await requireTrial(req(), trial.skill_id)).toBeNull();
  });
  it("rejects cross-site mutations", async () => {
    expect(
      (
        await trialAction(
          req(
            { action: "start", skillId: trial.skill_id },
            { origin: "https://other.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses the authenticated user and server skill length, ignoring injected entitlements", async () => {
    const response = await trialAction(
      req({
        action: "start",
        skillId: trial.skill_id,
        user_id: "victim",
        total_steps: 999,
        trials: 50,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_coaching_trial", {
      p_user_id: "verified-user",
      p_skill_id: trial.skill_id,
      p_total_steps: 7,
    });
  });
  it("does not create another trial after completion", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...trial, completed_at: "2026-10-17" },
      error: null,
    });
    expect(
      (await trialAction(req({ action: "start", skillId: trial.skill_id })))
        .status,
    ).toBe(409);
  });
  it("binds progress updates to the verified account", async () => {
    await trialAction(
      req({
        action: "progress",
        sessionId: trial.id,
        completedSteps: 7,
        userId: "victim",
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("advance_coaching_trial", {
      p_user_id: "verified-user",
      p_session_id: trial.id,
      p_completed_steps: 7,
    });
  });
});
describe("authentication boundaries", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/coach/../../auth/callback?code=bad",
    "/api/trial",
  ])("rejects unsafe return destination %s", (value) => {
    expect(safeNext(value)).toBe("/account");
  });
  it("keeps safe coach return links", () => {
    expect(safeNext("/coach/session/tie-four-in-hand?mode=watch")).toBe(
      "/coach/session/tie-four-in-hand?mode=watch",
    );
  });
  it.each(["/learn?skill=shaving", "/community", "/teach?request=123"])(
    "preserves shared account return destination %s",
    (value) => {
      expect(safeNext(value)).toBe(value);
    },
  );

  it("logs in with a password and sanitizes return URLs", async () => {
    const response = await authAction(
      req({
        action: "login",
        email: " Person@Example.com ",
        password: "some password",
        next: "https://evil.example",
      }),
    );
    expect(await response.json()).toEqual({ url: "/account" });
    expect(mocks.login).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "some password",
    });
    expect(mocks.signup).not.toHaveBeenCalled();
  });
  it("creates an account without trusting injected entitlement fields", async () => {
    expect(
      (
        await authAction(
          req({
            action: "signup",
            email: "person@example.com",
            password: "twelve words here",
            trials: 999,
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.signup).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "twelve words here",
      options: {
        emailRedirectTo: "https://plsteach.me/auth/callback?next=%2Faccount",
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["short", "a".repeat(73), "😀".repeat(19)])(
    "rejects weak or bcrypt-truncated passwords",
    async (password) => {
      for (const action of ["signup", "update-password"])
        expect(
          (
            await authAction(
              req({ action, email: "person@example.com", password }),
            )
          ).status,
        ).toBe(400);
      expect(mocks.signup).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("does not disclose existing accounts during registration", async () => {
    mocks.signup.mockResolvedValue({
      error: { code: "user_already_exists", status: 422 },
    });
    expect(
      await (
        await authAction(
          req({
            action: "signup",
            email: "person@example.com",
            password: "twelve words here",
          }),
        )
      ).json(),
    ).toEqual({ ok: true });
  });
  it.each([
    "email_address_not_authorized",
    "email_provider_disabled",
    "signup_disabled",
  ])(
    "reports mail configuration failures without leaking provider details: %s",
    async (code) => {
      for (const [action, mock] of [
        ["signup", mocks.signup],
        ["reset-password", mocks.reset],
        ["resend-confirmation", mocks.resend],
      ] as const) {
        mock.mockResolvedValue({
          error: { code, status: 400, message: "private provider config" },
        });
        const response = await authAction(
          req({
            action,
            email: "person@example.com",
            password: "twelve words here",
          }),
        );
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain(
          "private provider",
        );
      }
    },
  );
  it.each(["invalid_credentials", "user_not_found"])(
    "uses the same invalid-login message: %s",
    async (code) => {
      mocks.login.mockResolvedValue({ data: {}, error: { code, status: 400 } });
      const response = await authAction(
        req({
          action: "login",
          email: "person@example.com",
          password: "anything",
        }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error:
          "Email or password is incorrect. Try again or reset your password.",
      });
    },
  );
  it("offers confirmation for an unverified login", async () => {
    mocks.login.mockResolvedValue({
      data: {},
      error: { code: "email_not_confirmed", status: 400 },
    });
    expect(
      await (
        await authAction(
          req({
            action: "login",
            email: "person@example.com",
            password: "anything",
          }),
        )
      ).json(),
    ).toMatchObject({ code: "email_not_confirmed" });
  });
  it("sends recovery to the protected password page", async () => {
    await authAction(
      req({ action: "reset-password", email: "person@example.com" }),
    );
    expect(mocks.reset).toHaveBeenCalledWith("person@example.com", {
      redirectTo:
        "https://plsteach.me/auth/callback?next=%2Faccount%2Fpassword",
    });
  });
  it("resends confirmation without needing or retaining the password", async () => {
    await authAction(
      req({ action: "resend-confirmation", email: "person@example.com" }),
    );
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person@example.com",
      options: { emailRedirectTo: "https://plsteach.me/auth/callback" },
    });
  });
  it.each([null, { id: "guest", is_anonymous: true }])(
    "rejects password changes without a verified account",
    async (user) => {
      mocks.getUser.mockResolvedValue({ data: { user }, error: null });
      expect(
        (
          await authAction(
            req({
              action: "update-password",
              password: "twelve words here",
              user_id: "victim",
            }),
          )
        ).status,
      ).toBe(401);
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("changes only the current account password", async () => {
    expect(
      (
        await authAction(
          req({
            action: "update-password",
            password: "twelve words here",
            user_id: "victim",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      password: "twelve words here",
    });
  });
  it("requires fresh verification when the session is too old", async () => {
    mocks.update.mockResolvedValue({
      error: { code: "reauthentication_needed", status: 400 },
    });
    expect(
      await (
        await authAction(
          req({ action: "update-password", password: "twelve words here" }),
        )
      ).json(),
    ).toMatchObject({ code: "reauthentication_needed" });
  });
  it.each([
    "signup",
    "login",
    "reset-password",
    "resend-confirmation",
    "update-password",
    "signout",
  ])("rejects cross-origin %s", async (action) => {
    expect(
      (
        await authAction(
          req(
            {
              action,
              email: "person@example.com",
              password: "twelve words here",
            },
            { origin: "https://other.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(mocks.signup).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["email", "oauth"])(
    "rejects discontinued sign-in action %s",
    async (action) => {
      expect(
        (
          await authAction(
            req({
              action,
              email: "person@example.com",
              signup: true,
              provider: "google",
            }),
          )
        ).status,
      ).toBe(400);
    },
  );
  it("keeps provider rate limits visible", async () => {
    mocks.reset.mockResolvedValue({ error: { status: 429 } });
    expect(
      (
        await authAction(
          req({ action: "reset-password", email: "person@example.com" }),
        )
      ).status,
    ).toBe(429);
  });
});
