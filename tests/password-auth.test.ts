import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  recover: vi.fn(),
  resend: vi.fn(),
  oauth: vi.fn(),
  signout: vi.fn(),
  getUser: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
  claimed: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  exchange: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: state.cookieGet,
    set: state.cookieSet,
    delete: state.cookieDelete,
  }),
}));
vi.mock("@/lib/auth/config", () => ({
  authConfig: () => ({ enabled: true, google: true, apple: true }),
}));
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => ({
    auth: {
      signInWithPassword: state.login,
      signUp: state.signup,
      resetPasswordForEmail: state.recover,
      resend: state.resend,
      signInWithOAuth: state.oauth,
      signOut: state.signout,
      getUser: state.getUser,
      updateUser: state.update,
      exchangeCodeForSession: state.exchange,
      verifyOtp: state.verify,
    },
  }),
}));
vi.mock("@/lib/storage", () => ({
  hash: (value: string) => `hash:${value}`,
  db: () => ({
    rpc: state.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: state.claimed }) }),
    }),
  }),
}));
import { POST } from "../app/api/auth/action/route";
import { GET as callback } from "../app/auth/callback/route";
import { GET as confirm } from "../app/auth/confirm/route";
import {
  recoveryProof,
  validRecoveryProof,
} from "../lib/auth/password-recovery";

const id = "11111111-1111-4111-8111-111111111111";
const signup = {
  action: "signup",
  email: "Ada@Example.com",
  username: "Ada_L",
  firstName: " Ada ",
  lastName: " Lovelace ",
  password: "my long private password",
  acceptedTerms: true,
};
const request = (body: unknown, origin = "https://plsteach.me") =>
  new Request("https://plsteach.me/api/auth/action", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "isolated-test-recovery-signing-key");
  state.rpc.mockImplementation(async (name: string) => ({
    data: name === "account_login_email" ? "ada@example.com" : true,
    error: null,
  }));
  state.claimed.mockResolvedValue({ data: null, error: null });
  state.login.mockResolvedValue({
    data: { user: { id }, session: {} },
    error: null,
  });
  state.signup.mockResolvedValue({
    data: { user: { id }, session: null },
    error: null,
  });
  state.recover.mockResolvedValue({ error: null });
  state.resend.mockResolvedValue({ error: null });
  state.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  state.update.mockResolvedValue({ error: null });
  state.signout.mockResolvedValue({ error: null });
  state.exchange.mockResolvedValue({ data: { user: { id } }, error: null });
  state.verify.mockResolvedValue({ data: { user: { id } }, error: null });
});
describe("password accounts", () => {
  it("normalizes the email but preserves the exact password and sanitizes the destination", async () => {
    const response = await POST(
      request({
        action: "login",
        identifier: " Ada@Example.com ",
        password: " a private password ",
        next: "https://evil.test/",
      }),
    );
    expect(await response.json()).toEqual({ url: "/account" });
    expect(state.login).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: " a private password ",
      options: { captchaToken: undefined },
    });
    expect(state.signup).not.toHaveBeenCalled();
  });
  it("resolves a case-insensitive username only on the server", async () => {
    const response = await POST(
      request({
        action: "login",
        identifier: "ADA_L",
        password: "my private password",
        captchaToken: "check",
        next: "/learn?skill=tie",
      }),
    );
    expect(state.rpc).toHaveBeenCalledWith("account_login_email", {
      p_username: "ada_l",
    });
    expect(state.login).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        options: { captchaToken: "check" },
      }),
    );
    expect(await response.json()).toEqual({ url: "/learn?skill=tie" });
  });
  it("gives the same credential error for missing handles and wrong passwords", async () => {
    state.login.mockResolvedValue({
      error: { status: 400, message: "Invalid login credentials" },
    });
    const known = await POST(
      request({ action: "login", identifier: "ada_l", password: "wrong" }),
    );
    state.rpc.mockImplementation(async (name: string) => ({
      data: name === "account_login_email" ? null : true,
      error: null,
    }));
    const unknown = await POST(
      request({
        action: "login",
        identifier: "unknown_user",
        password: "wrong",
      }),
    );
    expect(known.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual(await known.json());
    expect(state.login).toHaveBeenCalledTimes(2);
  });
  it("creates a password account with normalized, bounded profile metadata and confirmation redirect", async () => {
    expect(
      (await POST(request({ ...signup, captchaToken: "captcha" }))).status,
    ).toBe(200);
    expect(state.signup).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: signup.password,
      options: {
        captchaToken: "captcha",
        emailRedirectTo: "https://plsteach.me/auth/callback?next=%2Faccount",
        data: {
          username: "ada_l",
          first_name: "Ada",
          last_name: "Lovelace",
          age_confirmed: true,
          terms_version: "2026-10-27",
        },
      },
    });
  });
  it.each([
    { password: "short" },
    { acceptedTerms: false },
    { username: "not a handle" },
    { firstName: "" },
  ])("rejects invalid registration %j before provider calls", async (patch) => {
    expect((await POST(request({ ...signup, ...patch }))).status).toBe(400);
    expect(state.signup).not.toHaveBeenCalled();
  });
  it("rejects a taken username without creating another account", async () => {
    state.claimed.mockResolvedValue({ data: { user_id: id }, error: null });
    expect((await POST(request(signup))).status).toBe(409);
    expect(state.signup).not.toHaveBeenCalled();
  });
  it.each([
    ["rate_limit", "PGRST202", "rate_hit"],
    ["username_lookup", "42501", "account_login_email"],
    ["profile_lookup", "42P01", "profile"],
  ])("logs safe diagnostics for %s without account details", async (stage, code, dependency) => {
    const message = "private-provider-message-with-credentials";
    const error = { code, message, details: "private-provider-details" };
    if (dependency === "profile") state.claimed.mockResolvedValue({ data: null, error });
    else state.rpc.mockImplementation(async (name: string) => ({ data: name === dependency ? null : true, error: name === dependency ? error : null }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request(dependency === "profile" ? signup : {
        action: "login", identifier: "private_username", password: "private-password-canary",
      }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Sign-in is temporarily unavailable. Please try again." });
      expect(log).toHaveBeenCalledTimes(1);
      const output = log.mock.calls[0][0] as string;
      expect(JSON.parse(output)).toMatchObject({ event: "auth.failed", stage, code });
      for (const secret of [message, error.details, "private_username", "private-password-canary", signup.email, signup.password])
        expect(output).not.toContain(secret);
      expect(state.login).not.toHaveBeenCalled();
      expect(state.signup).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("fails closed when the shared credential limiter is unavailable or exhausted", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect(
      (
        await POST(
          request({ action: "login", identifier: "ada", password: "pw" }),
        )
      ).status,
    ).toBe(503);
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect(
      (
        await POST(
          request({ action: "login", identifier: "ada", password: "pw" }),
        )
      ).status,
    ).toBe(429);
    expect(state.login).not.toHaveBeenCalled();
  });
  it("rejects cross-origin credential and profile submissions", async () => {
    expect((await POST(request(signup, "https://evil.test"))).status).toBe(403);
    expect(state.signup).not.toHaveBeenCalled();
  });
  it("preserves CAPTCHA failures without returning provider details", async () => {
    state.login.mockResolvedValue({
      error: { status: 400, message: "captcha invalid input" },
    });
    const result = await POST(
      request({ action: "login", identifier: "ada", password: "pw" }),
    );
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain("security check");
  });
});
describe("password recovery and existing accounts", () => {
  it("requests a recovery link, not an OTP login, with the correct return destination", async () => {
    expect(
      await (
        await POST(
          request({
            action: "recover",
            email: "Ada@Example.com",
            captchaToken: "check",
          }),
        )
      ).json(),
    ).toEqual({ ok: true });
    expect(state.recover).toHaveBeenCalledWith("ada@example.com", {
      redirectTo: "https://plsteach.me/auth/callback?next=%2Freset-password",
      captchaToken: "check",
    });
  });
  it("keeps the response generic for unknown email addresses", async () => {
    state.recover.mockResolvedValue({ error: { status: 400 } });
    expect(
      await (
        await POST(request({ action: "recover", email: "missing@example.com" }))
      ).json(),
    ).toEqual({ ok: true });
  });
  it("resends signup confirmation to the account page", async () => {
    await POST(request({ action: "resend", email: "ada@example.com" }));
    expect(state.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ada@example.com",
      options: {
        emailRedirectTo: "https://plsteach.me/auth/callback?next=%2Faccount",
        captchaToken: undefined,
      },
    });
  });
  it("requires a fresh verified recovery flow before changing a password", async () => {
    expect(
      (
        await POST(
          request({ action: "password", password: "my new long password" }),
        )
      ).status,
    ).toBe(401);
    expect(state.update).not.toHaveBeenCalled();
    state.cookieGet.mockReturnValue({ value: recoveryProof(id) });
    expect(
      await (
        await POST(
          request({ action: "password", password: "my new long password" }),
        )
      ).json(),
    ).toEqual({ url: "/account" });
    expect(state.update).toHaveBeenCalledWith({
      password: "my new long password",
    });
    expect(state.cookieDelete).toHaveBeenCalled();
    expect(state.signout).toHaveBeenCalledWith({ scope: "others" });
  });
  it("rejects forged, expired and other-account recovery proofs", () => {
    const now = Date.now();
    const proof = recoveryProof(id, now + 10000);
    expect(validRecoveryProof(proof, id, now)).toBe(true);
    expect(validRecoveryProof(proof, "other-user", now)).toBe(false);
    expect(validRecoveryProof(proof + "a", id, now)).toBe(false);
    expect(validRecoveryProof(proof, id, now + 10001)).toBe(false);
  });
  it("marks recovery only after exchanging a valid callback code", async () => {
    const response = await callback(
      new NextRequest(
        "https://plsteach.me/auth/callback?code=valid-code&next=/reset-password",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://plsteach.me/reset-password",
    );
    expect(state.cookieSet).toHaveBeenCalledWith(
      "plsteach-password-recovery",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, maxAge: 600 }),
    );
    state.cookieSet.mockClear();
    state.exchange.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    expect(
      (
        await callback(
          new NextRequest(
            "https://plsteach.me/auth/callback?code=expired&next=/reset-password",
          ),
        )
      ).headers.get("location"),
    ).toContain("/login?error=link");
    expect(state.cookieSet).not.toHaveBeenCalled();
  });
  it("supports cross-browser recovery confirmation and ordinary email verification", async () => {
    expect(
      (
        await confirm(
          new NextRequest(
            "https://plsteach.me/auth/confirm?token_hash=token&type=recovery",
          ),
        )
      ).headers.get("location"),
    ).toBe("https://plsteach.me/reset-password");
    expect(state.verify).toHaveBeenCalledWith({
      token_hash: "token",
      type: "recovery",
    });
    expect(state.cookieSet).toHaveBeenCalled();
    state.cookieSet.mockClear();
    expect(
      (
        await confirm(
          new NextRequest(
            "https://plsteach.me/auth/confirm?token_hash=token&type=email",
          ),
        )
      ).headers.get("location"),
    ).toBe("https://plsteach.me/learn");
    expect(state.cookieSet).not.toHaveBeenCalled();
  });
});
