import { z } from "zod";
import { authClient } from "@/lib/auth/server";
import { authProviders } from "@/lib/auth/providers";
import { safeNext, sameOrigin } from "@/lib/auth/redirect";
import { readJSON } from "@/lib/ai/server";
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("email"),
    email: z.email().max(254),
    signup: z.boolean(),
    next: z.string().optional(),
  }),
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
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reply({ error: "Please submit this form from plsteach.me." }, 403);
  let data;
  try {
    data = input.parse(await readJSON(request, 4000));
  } catch {
    return reply({ error: "Please enter a valid email address." }, 400);
  }
  try {
    const client = await authClient();
    if (!client)
      return reply(
        { error: "Sign-in is not available yet. Please try again later." },
        503,
      );
    if (data.action === "signout") {
      const { error } = await client.auth.signOut();
      return error
        ? reply({ error: "Could not sign out. Please try again." }, 503)
        : reply({ ok: true });
    }
    const callback = new URL("/auth/callback", request.headers.get('origin')!);
    callback.searchParams.set("next", safeNext(data.next));
    if (data.action === "email") {
      const { error } = await client.auth.signInWithOtp({
        email: data.email.trim().toLowerCase(),
        options: {
          shouldCreateUser: data.signup,
          emailRedirectTo: callback.href,
        },
      });
      if (error?.status === 429)
        return reply(
          { error: "Please wait a minute before requesting another link." },
          429,
        );
      // These are delivery/configuration failures, not an unknown account.
      // In particular, Supabase's built-in mailer rejects non-team recipients.
      if (error?.code && ['email_address_not_authorized', 'email_provider_disabled', 'signup_disabled'].includes(error.code))
        return reply(
          { error: "Email sign-in is temporarily unavailable. Please try again later." },
          503,
        );
      // Do not disclose whether an address is already registered.
      if (error && error.status !== 400 && error.status !== 422)
        return reply(
          { error: "We could not send the link. Please try again shortly." },
          503,
        );
      return reply({ ok: true });
    }
    if (!(await authProviders())[data.provider])
      return reply(
        {
          error: "This sign-in option is not available yet. Please use email.",
        },
        503,
      );
    const { data: result, error } = await client.auth.signInWithOAuth({
      provider: data.provider,
      options: { redirectTo: callback.href, skipBrowserRedirect: true },
    });
    if (error || !result.url)
      return reply(
        { error: "Could not connect. Please try again or use email." },
        503,
      );
    return reply({ url: result.url });
  } catch {
    return reply(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      503,
    );
  }
}
