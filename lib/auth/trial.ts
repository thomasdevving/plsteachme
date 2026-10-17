import "server-only";
import { db } from "@/lib/storage";
import { authenticatedUser } from "./server";
import { authConfig } from "./config";
import { sameOrigin } from "./redirect";
export type Trial = {
  id: string;
  skill_id: string;
  total_steps: number;
  completed_steps: number;
  completed_at: string | null;
  started_at: string;
};
export async function getTrial(userId: string): Promise<Trial | null> {
  const { data, error } = await db()
    .from("coaching_trials")
    .select("id,skill_id,total_steps,completed_steps,completed_at,started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Trial unavailable");
  return data;
}
export async function requireTrial(
  request: Request,
  skillId: string,
): Promise<Response | null> {
  const fail = (error: string, status: number) =>
    Response.json(
      { error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!sameOrigin(request))
    return fail("Please use the coaching page to continue.", 403);
  if (!authConfig().enabled)
    return fail("Account sign-in is not available yet.", 503);
  try {
    const user = await authenticatedUser();
    if (!user) return fail("Please sign in to use your free session.", 401);
    const trial = await getTrial(user.id);
    if (
      !trial ||
      trial.completed_at ||
      trial.skill_id !== skillId ||
      trial.id !== request.headers.get("x-coaching-session")
    )
      return fail(
        "Your free session is unavailable or already completed.",
        403,
      );
    return null;
  } catch {
    return fail("Could not check your session. Please try again.", 503);
  }
}
