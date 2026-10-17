import { NextRequest, NextResponse } from "next/server";
import { refreshAuth } from "@/lib/auth/proxy";
export async function proxy(request: NextRequest) {
  const authPath =
    /^\/(?:(?:en|nl)\/)?(?:login|signup|account|learn|community|teach|demo)(?:\/|$)/.test(
      request.nextUrl.pathname,
    ) || request.nextUrl.pathname.startsWith("/coach/session/");
  const sessionResponse = authPath ? await refreshAuth(request) : null;
  const url = request.nextUrl.clone();
  // Coach has its own root layout; model/SVG assets must bypass locale routing.
  if (
    /^\/(auth|coach|skills|mediapipe)(\/|$)/.test(url.pathname) ||
    /^\/(sw\.js|manifest\.webmanifest|icon-\d+\.png)$/.test(url.pathname)
  )
    return sessionResponse || NextResponse.next();
  const original = url.pathname;
  url.pathname = url.pathname.replace(/^\/(?:en|nl)(?=\/|$)/, "") || "/";
  url.pathname =
    (
      { "/organisaties": "/organizations", "/bedankt": "/thanks" } as Record<
        string,
        string
      >
    )[url.pathname] || url.pathname;
  if (url.pathname !== original) {
    const response = NextResponse.redirect(url, 308);
    if (sessionResponse) {
      for (const cookie of sessionResponse.cookies.getAll())
        response.cookies.set(cookie);
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  }
  url.pathname = `/en${url.pathname === "/" ? "" : url.pathname}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-plsteach-locale", "en");
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  if (sessionResponse) {
    for (const cookie of sessionResponse.cookies.getAll())
      response.cookies.set(cookie);
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next|fonts/|brand/|mascots/|tie.svg|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
