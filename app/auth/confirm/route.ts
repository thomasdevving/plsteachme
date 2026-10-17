import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/auth/server";
import { requestOrigin } from "@/lib/request-origin";
function redirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") || "email";
  const recovery = type === "recovery";
  try {
    const client = await authClient();
    if (
      client &&
      token_hash &&
      (type === "email" || type === "signup" || recovery)
    ) {
      const { error } = await client.auth.verifyOtp({ token_hash, type });
      if (!error)
        return redirect(
          new URL(
            recovery ? "/account/password" : "/account",
            requestOrigin(request),
          ),
        );
    }
  } catch {
    /* Do not expose tokens or provider messages. */
  }
  return redirect(
    new URL(
      recovery ? "/forgot-password?error=link" : "/login?error=link",
      requestOrigin(request),
    ),
  );
}
