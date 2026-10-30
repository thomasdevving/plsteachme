import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "./config";
import { needsMfa } from "./mfa";
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
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user && !user.is_anonymous && !/^\/(?:(?:en|nl)\/)?(?:login|signup|forgot-password)(?:\/|$)/.test(request.nextUrl.pathname) && await needsMfa(client, user)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login/mfa';
      url.search = '';
      url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(url);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      redirect.headers.set('Cache-Control', 'private, no-store');
      return redirect;
    }
  } catch {
    /* The page handles unavailable sign-in. */
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
