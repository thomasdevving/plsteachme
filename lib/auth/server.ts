import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "./config";
import { needsMfa } from "./mfa";
import { serviceFetch } from "../network";
export async function authClient() {
  const { url, key, enabled } = authConfig();
  if (!enabled) return null;
  const jar = await cookies();
  return createServerClient(url!, key!, {
    global: { fetch: serviceFetch },
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        } catch {
          /* Server components read cookies; proxy refreshes them. */
        }
      },
    },
  });
}
export async function authenticatedUser() {
  const client = await authClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return await needsMfa(client, data.user) ? null : data.user;
}
