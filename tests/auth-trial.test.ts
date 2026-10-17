import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  oauth: vi.fn(),
  otp: vi.fn(),
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
      signInWithOAuth: mocks.oauth,
      signInWithOtp: mocks.otp,
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
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.user.mockResolvedValue({ id: "verified-user" });
  mocks.maybeSingle.mockResolvedValue({ data: trial, error: null });
  mocks.rpc.mockResolvedValue({ data: trial, error: null });
  mocks.otp.mockResolvedValue({ error: null });
  mocks.oauth.mockResolvedValue({
    data: { url: "https://provider.example/authorize" },
    error: null,
  });
});
describe("one free session authorization", () => {
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
  it("email sign-in cannot silently create an account", async () => {
    const response = await authAction(
      req({ action: "email", email: "person@example.com", signup: false }),
    );
    expect(response.status).toBe(200);
    expect(mocks.otp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
  });
  it("email sign-up explicitly enables registration", async () => {
    await authAction(
      req({ action: "email", email: "person@example.com", signup: true }),
    );
    expect(mocks.otp.mock.calls[0][0].options.shouldCreateUser).toBe(true);
  });
  it("does not reveal whether an email is registered", async () => {
    mocks.otp.mockResolvedValue({ error: { status: 400 } });
    expect(
      await (
        await authAction(
          req({ action: "email", email: "unknown@example.com", signup: false }),
        )
      ).json(),
    ).toEqual({ ok: true });
  });
  it("sanitizes the OAuth redirect", async () => {
    await authAction(
      req({ action: "oauth", provider: "apple", next: "https://evil.example" }),
    );
    expect(mocks.oauth.mock.calls[0][0].options.redirectTo).toBe(
      "https://plsteach.me/auth/callback?next=%2Faccount",
    );
  });
});
