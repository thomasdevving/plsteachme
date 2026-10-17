import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { authenticatedUser } from "@/lib/auth/server";
import { sameOrigin } from "@/lib/auth/redirect";
import { db } from "@/lib/storage";
import { readJSON } from "@/lib/ai/server";
import { getSkill } from "@/lib/skills/loader";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), skillId: z.string().max(80) }),
  z.object({
    action: z.literal("progress"),
    sessionId: z.uuid(),
    completedSteps: z.number().int().min(0).max(100),
  }),
]);
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reply({ error: "Please use the coaching page to continue." }, 403);
  if (!authConfig().enabled)
    return reply({ error: "Sign-in is not available yet." }, 503);
  try {
    const user = await authenticatedUser();
    if (!user)
      return reply(
        { error: "Please sign in to start your free session." },
        401,
      );
    let input;
    try {
      input = schema.parse(await readJSON(request, 4000));
    } catch {
      return reply({ error: "Invalid session request." }, 400);
    }
    if (input.action === "start") {
      const skill = getSkill(input.skillId);
      if (!skill || skill.status !== "available")
        return reply({ error: "This skill is not available yet." }, 404);
      const { data, error } = await db().rpc("claim_coaching_trial", {
        p_user_id: user.id,
        p_skill_id: skill.id,
        p_total_steps: skill.steps.length,
      });
      if (error) throw error;
      if (!data || data.completed_at || data.skill_id !== skill.id)
        return reply(
          {
            error: "Your one free session has already been started.",
            trial: data,
          },
          409,
        );
      return reply({ trial: data });
    }
    const { data, error } = await db().rpc("advance_coaching_trial", {
      p_user_id: user.id,
      p_session_id: input.sessionId,
      p_completed_steps: input.completedSteps,
    });
    if (error) throw error;
    if (!data)
      return reply(
        { error: "This session does not belong to your account." },
        403,
      );
    return reply({ trial: data });
  } catch {
    return reply(
      { error: "Your session could not be saved. Please try again." },
      503,
    );
  }
}
