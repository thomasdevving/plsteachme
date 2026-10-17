import { authenticatedUser } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { getTrial } from "@/lib/auth/trial";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    if (!authConfig().enabled)
      return Response.json({ user: null, configured: false }, { headers });
    const user = await authenticatedUser();
    if (!user)
      return Response.json({ user: null, configured: true }, { headers });
    const trial = await getTrial(user.id);
    return Response.json(
      { user: { email: user.email }, trial, configured: true },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Your account could not load. Please try again." },
      { status: 503, headers },
    );
  }
}
