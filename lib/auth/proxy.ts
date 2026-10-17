import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "./config";
import { serviceFetch } from "../network";
export async function refreshAuth(request: NextRequest) {
  const { url, key, enabled } = authConfig();
  let response = NextResponse.next({ request });
  if (!enabled) return response;
  const client = createServerClient(url!, key!, {
    global: { fetch: serviceFetch },
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await client.auth.getUser();
  } catch {
    /* The page handles unavailable sign-in. */
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
