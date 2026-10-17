import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/auth/server";
import { safeNext } from "@/lib/auth/redirect";
import { requestOrigin } from '@/lib/request-origin';
function redirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  try {
    const client = await authClient();
    if (client && code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return redirect(
          new URL(
            safeNext(request.nextUrl.searchParams.get("next")),
            requestOrigin(request),
          ),
        );
    }
  } catch {
    /* Use a safe, non-sensitive error message on the login form. */
  }
  return redirect(new URL("/login?error=link", requestOrigin(request)));
}
