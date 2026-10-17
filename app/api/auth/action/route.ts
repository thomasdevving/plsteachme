import { z } from "zod";
import { authClient } from "@/lib/auth/server";
import { passwordError } from "@/lib/auth/password";
import { safeNext, sameOrigin } from "@/lib/auth/redirect";
import { readJSON } from "@/lib/ai/server";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(1).max(1024);
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("signup"),
    email,
    password,
    next: z.string().optional(),
  }),
  z.object({
    action: z.literal("login"),
    email,
    password,
    next: z.string().optional(),
  }),
  z.object({ action: z.literal("resend-confirmation"), email }),
  z.object({ action: z.literal("reset-password"), email }),
  z.object({ action: z.literal("update-password"), password }),
  z.object({ action: z.literal("signout") }),
]);
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const unavailable = () =>
  reply(
    {
      error:
        "Account services are temporarily unavailable. Please try again shortly.",
    },
    503,
  );

type ProviderError = { code?: string; status?: number } | null;
function deliveryResult(error: ProviderError) {
  if (error?.status === 429)
    return reply(
      { error: "Please wait a minute before requesting another email." },
      429,
    );
  // Only known account-existence errors are hidden. Delivery failures must be visible.
  if (
    error &&
    !["user_already_exists", "email_exists", "user_not_found"].includes(
      error.code || "",
    )
  )
    return unavailable();
  return reply({ ok: true });
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reply({ error: "Please submit this form from plsteach.me." }, 403);
  let data;
  try {
    data = input.parse(await readJSON(request, 4000));
  } catch {
    return reply(
      { error: "Please check your email and password and try again." },
      400,
    );
  }
  if (data.action === "signup" || data.action === "update-password") {
    const error = passwordError(data.password);
    if (error) return reply({ error }, 400);
  }
  try {
    const client = await authClient();
    if (!client) return unavailable();
    if (data.action === "signout") {
      const { error } = await client.auth.signOut();
      return error ? unavailable() : reply({ ok: true });
    }
    if (data.action === "login") {
      const { data: result, error } = await client.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error?.status === 429)
        return reply(
          { error: "Too many attempts. Please wait a minute and try again." },
          429,
        );
      if (error?.code === "email_not_confirmed")
        return reply(
          {
            error:
              "Confirm your email before logging in. You can request a new confirmation below.",
            code: "email_not_confirmed",
          },
          401,
        );
      if (error && error.status && error.status >= 500) return unavailable();
      if (error || !result.session)
        return reply(
          {
            error:
              "Email or password is incorrect. Try again or reset your password.",
          },
          401,
        );
      return reply({ url: safeNext(data.next) });
    }
    if (data.action === "update-password") {
      // Identity comes only from the verified session, never request body fields.
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user || user.is_anonymous)
        return reply(
          { error: "Please log in or open a new password reset link first." },
          401,
        );
      const { error } = await client.auth.updateUser({
        password: data.password,
      });
      if (error?.status === 429)
        return reply({ error: "Please wait a minute and try again." }, 429);
      if (
        error?.code === "reauthentication_needed" ||
        error?.code === "reauthentication_not_valid"
      )
        return reply(
          {
            error:
              "For your security, open a new password reset link before changing your password.",
            code: "reauthentication_needed",
          },
          401,
        );
      if (error?.code === "same_password")
        return reply(
          { error: "Choose a different password from your current one." },
          400,
        );
      if (error?.code === "weak_password")
        return reply(
          { error: "Choose a stronger password with at least 12 characters." },
          400,
        );
      return error ? unavailable() : reply({ ok: true });
    }
    const callback = new URL("/auth/callback", request.headers.get("origin")!);
    if (data.action === "reset-password") {
      callback.searchParams.set("next", "/account/password");
      const { error } = await client.auth.resetPasswordForEmail(data.email, {
        redirectTo: callback.href,
      });
      return deliveryResult(error);
    }
    if (data.action === "resend-confirmation") {
      const { error } = await client.auth.resend({
        type: "signup",
        email: data.email,
        options: { emailRedirectTo: callback.href },
      });
      return deliveryResult(error);
    }
    callback.searchParams.set("next", safeNext(data.next));
    const { error } = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo: callback.href },
    });
    if (error?.code === "weak_password")
      return reply(
        { error: "Choose a stronger password with at least 12 characters." },
        400,
      );
    return deliveryResult(error);
  } catch {
    return unavailable();
  }
}
