import { z } from "zod";
import { authClient } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { safeNext, sameOrigin } from "@/lib/auth/redirect";
import { usernameSchema, nameSchema, passwordSchema } from "@/lib/auth/profile";
import {
  passwordResetAllowed,
  clearPasswordReset,
} from "@/lib/auth/password-recovery";
import { limitedJson } from "@/lib/coaching-security";
import { clientIp } from "@/lib/client-ip";
import { db, hash } from "@/lib/storage";
import { requestOrigin } from "@/lib/request-origin";
import { logError } from "@/lib/log";

const captcha = z.string().max(4096).optional();
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("login"),
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(128),
    captchaToken: captcha,
    next: z.string().optional(),
  }),
  z.object({
    action: z.literal("signup"),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    username: usernameSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    password: passwordSchema,
    acceptedTerms: z.literal(true),
    captchaToken: captcha,
    next: z.string().optional(),
  }),
  z.object({
    action: z.literal("recover"),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    captchaToken: captcha,
  }),
  z.object({
    action: z.literal("resend"),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    captchaToken: captcha,
  }),
  z.object({ action: z.literal("password"), password: passwordSchema }),
  z.object({
    action: z.literal("oauth"),
    provider: z.enum(["google", "apple"]),
    next: z.string().optional(),
  }),
  z.object({ action: z.literal("signout") }),
]);
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const incorrect = () =>
  reply(
    {
      error: "The email, username or password is incorrect. Please try again.",
    },
    401,
  );
async function rate(request: Request, action: string, identity: string) {
  // Credential limits fail closed. Rate keys contain hashes, never raw email addresses.
  for (const [key, max] of [
    [
      `auth-${action}-ip:${hash(clientIp(request))}`,
      action === "login" ? 30 : 8,
    ],
    [`auth-${action}-id:${hash(identity)}`, action === "login" ? 12 : 4],
  ] as const) {
    const { data, error } = await db().rpc("rate_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: 900,
    });
    if (error) throw error;
    if (data !== true) return false;
  }
  return true;
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reply({ error: "Please submit this form from plsteach.me." }, 403);
  const body = await limitedJson(request, 8000);
  if ("error" in body)
    return reply(
      { error: "The request is invalid or too large." },
      body.error === "size" ? 413 : 400,
    );
  const parsed = input.safeParse(body.data);
  if (!parsed.success)
    return reply(
      {
        error:
          parsed.error.issues[0]?.message ||
          "Please check your account details.",
      },
      400,
    );
  const data = parsed.data;
  let stage = "auth_client";
  try {
    const client = await authClient();
    if (!client)
      return reply(
        {
          error: "Sign-in is temporarily unavailable. Please try again later.",
        },
        503,
      );
    if (data.action === "signout") {
      stage = "signout";
      const { error } = await client.auth.signOut();
      await clearPasswordReset();
      return error
        ? reply({ error: "Could not sign out. Please try again." }, 503)
        : reply({ ok: true });
    }
    if (data.action === "password") {
      stage = "recovery_verification";
      const { data: account, error } = await client.auth.getUser();
      if (
        error ||
        !account.user ||
        account.user.is_anonymous ||
        !(await passwordResetAllowed(account.user.id))
      )
        return reply(
          {
            error:
              "Request a fresh password reset email and open its link to set your password.",
          },
          401,
        );
      stage = "rate_limit";
      if (!(await rate(request, "password", account.user.id)))
        return reply(
          { error: "Too many attempts. Please try again in 15 minutes." },
          429,
        );
      stage = "password_update";
      const changed = await client.auth.updateUser({ password: data.password });
      if (changed.error)
        return reply(
          {
            error:
              "Your password could not be updated. Choose a different password or request a fresh reset link.",
          },
          400,
        );
      await clearPasswordReset();
      await client.auth.signOut({ scope: "others" });
      return reply({ url: "/account" });
    }
    stage = "callback_origin";
    const callback = new URL("/auth/callback", requestOrigin(request));
    callback.searchParams.set(
      "next",
      safeNext(
        "next" in data
          ? data.next
          : data.action === "recover"
            ? "/reset-password"
            : "/account",
      ),
    );
    if (data.action === "oauth") {
      stage = "oauth";
      if (!authConfig()[data.provider])
        return reply(
          {
            error:
              "This sign-in option is not available yet. Please use your email and password.",
          },
          503,
        );
      const { data: result, error } = await client.auth.signInWithOAuth({
        provider: data.provider,
        options: { redirectTo: callback.href, skipBrowserRedirect: true },
      });
      return error || !result.url
        ? reply({ error: "Could not connect. Please try again." }, 503)
        : reply({ url: result.url });
    }
    const identity = (data.action === "login" ? data.identifier : data.email)
      .trim()
      .toLowerCase();
    stage = "rate_limit";
    if (!(await rate(request, data.action, identity)))
      return reply(
        { error: "Too many attempts. Please try again in 15 minutes." },
        429,
      );
    if (data.action === "login") {
      let email = identity;
      if (!identity.includes("@")) {
        const username = usernameSchema.safeParse(identity);
        if (!username.success) return incorrect();
        stage = "username_lookup";
        const resolved = await db().rpc("account_login_email", {
          p_username: username.data,
        });
        if (resolved.error) throw resolved.error;
        // Ask the provider even for an unknown handle; never return the resolved email to the caller.
        email = resolved.data || `${hash(identity)}@account.invalid`;
      }
      stage = "password_login";
      const result = await client.auth.signInWithPassword({
        email,
        password: data.password,
        options: { captchaToken: data.captchaToken },
      });
      if (result.error) return providerFailure(result.error) || incorrect();
      return reply({ url: safeNext(data.next) });
    }
    if (data.action === "recover") {
      stage = "recovery_email";
      const { error } = await client.auth.resetPasswordForEmail(data.email, {
        redirectTo: callback.href,
        captchaToken: data.captchaToken,
      });
      if (error) {
        const failure = providerFailure(error);
        if (failure) return failure;
        if (
          error.status !== 400 &&
          error.status !== 404 &&
          error.status !== 422
        )
          return reply(
            {
              error:
                "We could not send a reset email. Please try again shortly.",
            },
            503,
          );
      }
      return reply({ ok: true });
    }
    if (data.action === "resend") {
      stage = "confirmation_email";
      const { error } = await client.auth.resend({
        type: "signup",
        email: data.email,
        options: {
          emailRedirectTo: callback.href,
          captchaToken: data.captchaToken,
        },
      });
      if (error) {
        const failure = providerFailure(error);
        if (failure) return failure;
        if (error.status !== 400 && error.status !== 422)
          return reply(
            {
              error:
                "We could not send the confirmation email. Please try again shortly.",
            },
            503,
          );
      }
      return reply({ ok: true });
    }
    stage = "profile_lookup";
    const claimed = await db()
      .from("account_profiles")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    if (claimed.error) throw claimed.error;
    if (claimed.data)
      return reply(
        { error: "That username is already taken. Please choose another." },
        409,
      );
    stage = "signup";
    const { data: result, error } = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: callback.href,
        captchaToken: data.captchaToken,
        data: {
          username: data.username,
          first_name: data.firstName,
          last_name: data.lastName,
          age_confirmed: true,
          terms_version: "2026-10-27",
        },
      },
    });
    if (error) {
      if (["user_already_exists", "email_exists"].includes(error.code || ""))
        return reply({ ok: true });
      return (
        providerFailure(error) ||
        reply(
          {
            error:
              "Your account could not be created. Please try another username or use password reset if you already have an account.",
          },
          400,
        )
      );
    }
    return result.session
      ? reply({ url: safeNext(data.next) })
      : reply({ ok: true });
  } catch (error) {
    // Log the failing step and standard database code only. Provider messages
    // can contain credentials or personal data and must never reach logs.
    const rawCode = error && typeof error === "object" && "code" in error
      ? error.code : undefined;
    const code = typeof rawCode === "string" && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(rawCode)
      ? rawCode : undefined;
    logError("auth.failed", { action: data.action, stage, code });
    return reply(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      503,
    );
  }
}
function providerFailure(error: { message?: string; status?: number }) {
  if (/captcha/i.test(error.message || ""))
    return reply(
      { error: "The security check expired. Please complete it again." },
      400,
    );
  if (error.status === 429)
    return reply(
      { error: "Too many attempts. Please wait before trying again." },
      429,
    );
  if (error.status && error.status >= 500)
    return reply(
      {
        error:
          "The account service is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  return null;
}
