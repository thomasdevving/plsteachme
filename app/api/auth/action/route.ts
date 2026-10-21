import { z } from "zod";
import { authClient } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { safeNext, sameOrigin } from "@/lib/auth/redirect";
import { readJSON } from "@/lib/ai/server";
import { sharedRateAllowed } from "@/lib/ai-guard";
import { clientIp } from "@/lib/client-ip";
import { hash } from "@/lib/storage";
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("email"),
    email: z.email().max(254),
    signup: z.boolean(),
    next: z.string().optional(),
    captchaToken: z.string().max(4096).optional(),
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
      const email = data.email.trim().toLowerCase();
      // Shared limits stop sign-in emails being used to flood an inbox or mass-create accounts.
      if (
        !(await sharedRateAllowed(`signin-ip:${hash(clientIp(request))}`, 8, 3600)) ||
        !(await sharedRateAllowed(`signin-email:${hash(email)}`, 4, 3600))
      )
        return reply(
          { error: "Too many sign-in links were requested. Please try again in an hour." },
          429,
        );
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: data.signup,
          emailRedirectTo: callback.href,
          captchaToken: data.captchaToken,
        },
      });
      if (error && /captcha/i.test(error.message ?? ""))
        return reply(
          { error: "The security check expired. Please complete it again." },
          400,
        );
      if (error?.status === 429)
        return reply(
          { error: "Please wait a minute before requesting another link." },
          429,
        );
      // Do not disclose whether an address is already registered.
      if (error && error.status !== 400 && error.status !== 422)
        return reply(
          { error: "We could not send the link. Please try again shortly." },
          503,
        );
      return reply({ ok: true });
    }
    if (!authConfig()[data.provider])
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
