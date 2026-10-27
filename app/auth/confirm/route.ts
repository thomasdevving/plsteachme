import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/auth/server";
import { requestOrigin } from '@/lib/request-origin';
import { allowPasswordReset } from '@/lib/auth/password-recovery';
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
      const recovery = request.nextUrl.searchParams.get('type') === 'recovery';
      const { data, error } = await client.auth.verifyOtp({
        token_hash,
        type: recovery ? 'recovery' : 'email',
      });
      if (!error) {
        if (recovery && data.user) await allowPasswordReset(data.user.id);
        return redirect(new URL(recovery ? '/reset-password' : '/account', requestOrigin(request)));
      }
    }
  } catch {
    /* Do not expose tokens or provider messages. */
  }
  return redirect(new URL("/login?error=link", requestOrigin(request)));
}
