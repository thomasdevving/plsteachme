import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/auth/server";
import { requestOrigin } from '@/lib/request-origin';
function redirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  try {
    const client = await authClient();
    if (client && token_hash) {
      const { error } = await client.auth.verifyOtp({
        token_hash,
        type: "email",
      });
      if (!error) return redirect(new URL("/account", requestOrigin(request)));
    }
  } catch {
    /* Do not expose tokens or provider messages. */
  }
  return redirect(new URL("/login?error=link", requestOrigin(request)));
}
