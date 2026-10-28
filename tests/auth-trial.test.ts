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
  mockMode: false,
  hash: (value: string) => `h:${value}`,
  db: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
  }),
}));
import { safeNext } from "../lib/auth/redirect";
import { requireTrial } from "../lib/auth/trial";
import { builtinTrialId, publishedTrialId, trialResumeHref } from '../lib/auth/trial-reference';
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
  vi.stubEnv("OPENAI_API_KEY","test-key");
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.user.mockResolvedValue({ id: "verified-user" });
  mocks.maybeSingle.mockResolvedValue({ data: trial, error: null });
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "coaching_trial_use" ? "ok" : name === "ai_budget_use" || name === "rate_hit" ? true : trial, error: null }));
  mocks.otp.mockResolvedValue({ error: null });
  mocks.oauth.mockResolvedValue({
    data: { url: "https://provider.example/authorize" },
    error: null,
  });
});
describe("one free session authorization", () => {
  it('does not consume a trial when OpenAI is absent',async()=>{vi.stubEnv('OPENAI_API_KEY','');expect((await trialAction(req({action:'start',skillId:trial.skill_id}))).status).toBe(503);expect(mocks.rpc).not.toHaveBeenCalled();});
  it('rejects anonymous Supabase accounts',async()=>{mocks.user.mockResolvedValue({id:'guest',is_anonymous:true});expect((await requireTrial(req(),trial.skill_id))?.status).toBe(401);expect((await trialAction(req({action:'start',skillId:trial.skill_id}))).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();});
  it('uses the same durable trial for new lessons and preserves the previous chosen skill',async()=>{
    expect((await trialAction(req({action:'start',skillId:'builtin:laundry'}))).status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledWith('claim_coaching_trial',{p_user_id:'verified-user',p_skill_id:'builtin:laundry',p_total_steps:7,p_email:null});
    expect(builtinTrialId('tie')).toBe(trial.skill_id);
    expect((await trialAction(req({action:'start',skillId:'builtin:tie'}))).status).toBe(404);
  });
  it('requires an active matching account session even for the consent endpoint',async()=>{expect(await requireTrial(req())).toBeNull();mocks.maybeSingle.mockResolvedValue({data:{...trial,completed_at:'2026-10-17'},error:null});expect((await requireTrial(req()))?.status).toBe(403);});
  it('resumes new lessons without creating a separate account entitlement',()=>{expect(trialResumeHref('builtin:laundry')).toBe('/learn/laundry');const id='11111111-1111-4111-8111-111111111111';expect(trialResumeHref(publishedTrialId(id,2))).toBe(`/learn/lessons/${id}`);expect(trialResumeHref(trial.skill_id)).toBe('/learn/tie');});
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
    expect(mocks.rpc).toHaveBeenCalledWith("coaching_trial_use", { p_user_id: "verified-user", p_session_id: trial.id, p_max_calls: 150, p_max_minutes: 120 });
    expect(mocks.rpc).toHaveBeenCalledWith("ai_budget_use", { p_kind: "coaching", p_daily_limit: 3000 });
  });
  it("ends a free session once its AI checks or time run out, and pauses on the daily budget", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "coaching_trial_use" ? "exhausted" : true, error: null }));
    const ended = await requireTrial(req(), trial.skill_id);
    expect(ended?.status).toBe(403);
    expect((await ended!.json()).error).toContain("ended");
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "coaching_trial_use" ? "ok" : false, error: null }));
    const paused = await requireTrial(req(), trial.skill_id);
    expect(paused?.status).toBe(503);
    expect((await paused!.json()).error).toContain("paused");
    // A storage failure in the budget check fails closed.
    mocks.rpc.mockImplementation(async (name: string) => (name === "coaching_trial_use" ? { data: "ok", error: null } : { data: null, error: { message: "down" } }));
    expect((await requireTrial(req(), trial.skill_id))?.status).toBe(503);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  it("does not count AI use when only opening a coaching session", async () => {
    expect(await requireTrial(req(), undefined, { countAi: false })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
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
      p_email: null,
    });
  });
  it("does not create another trial after completion", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...trial, completed_at: "2026-10-17" },
      error: null,
    } as never);
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
  it.each(['/learn?skill=shaving','/learn/tie','/training/modules/11111111-1111-4111-8111-111111111111','/community','/teach?request=123'])('preserves shared account return destination %s',value=>{expect(safeNext(value)).toBe(value);});
  it("removes the passwordless login action", async () => {
    expect((await authAction(req({action:'email',email:'person@example.com',signup:false}))).status).toBe(400);
    expect(mocks.otp).not.toHaveBeenCalled();
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
