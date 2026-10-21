import "server-only";
import { db } from "@/lib/storage";
import { authenticatedUser } from "./server";
import { authConfig } from "./config";
import { sameOrigin } from "./redirect";
import { aiBudgetAllowed, trialAiUse } from "../ai-guard";
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
const fail = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
/**
 * The signed-in account and its open free session for this lesson, or the response that
 * explains why it is unavailable. Counts nothing.
 */
export async function trialAccess(
  request: Request,
  skillId?: string,
): Promise<Response | { user: { id: string }; trial: Trial }> {
  if (!sameOrigin(request))
    return fail("Please use the coaching page to continue.", 403);
  if (!authConfig().enabled)
    return fail("Account sign-in is not available yet.", 503);
  try {
    const user = await authenticatedUser();
    if (!user || user.is_anonymous) return fail("Please sign in to use your free session.", 401);
    const trial = await getTrial(user.id);
    if (
      !trial ||
      trial.completed_at ||
      (skillId !== undefined && trial.skill_id !== skillId) ||
      trial.id !== request.headers.get("x-coaching-session")
    )
      return fail(
        "Your free session is unavailable or already completed.",
        403,
      );
    return { user, trial };
  } catch {
    return fail("Could not check your session. Please try again.", 503);
  }
}
/**
 * Checks the signed-in account's free session for this lesson. Unless `countAi` is
 * false, it also counts one AI call against the session and the daily budget.
 */
export async function requireTrial(
  request: Request,
  skillId?: string,
  { countAi = true }: { countAi?: boolean } = {},
): Promise<Response | null> {
  const access = await trialAccess(request, skillId);
  if (access instanceof Response) return access;
  if (!countAi) return null;
  try {
    const { user, trial } = access;
    const use = await trialAiUse(user.id, trial.id);
    if (use === "exhausted" || use === "completed")
      return fail(
        "Your free session has ended: it covers one lesson within two hours. Thanks for trying plsteach.me!",
        403,
      );
    if (use !== "ok") return fail("Could not check your session. Please try again.", 503);
    if (!(await aiBudgetAllowed("coaching")))
      return fail(
        "Camera coaching is paused for today because of high demand. Your session is kept; please try again tomorrow.",
        503,
      );
    return null;
  } catch {
    return fail("Could not check your session. Please try again.", 503);
  }
}
