import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { authenticatedUser } from "@/lib/auth/server";
import { sameOrigin } from "@/lib/auth/redirect";
import { db } from "@/lib/storage";
import { readJSON } from "@/lib/ai/server";
import { getSkill } from "@/lib/skills/catalog";
import { modules } from '@/lib/modules';
import { skillIds, type SkillId } from '@/lib/config';
import { coachingConfigured } from '@/lib/coaching-security';
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
    if (!user || user.is_anonymous)
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
      // Never spend an account's one session while its AI service is unavailable.
      if (!coachingConfigured()) return reply({error:'Camera coaching is not connected yet. Your free session has not been used.'},503);
      let resolved: {id:string;total:number}|null=null;
      const builtin=input.skillId.startsWith('builtin:')?input.skillId.slice(8):null;
      if(builtin && skillIds.includes(builtin as SkillId) && builtin!=='tie') resolved={id:input.skillId,total:modules[builtin as SkillId].steps.length};
      const published=/^published:([a-f0-9-]{36}):v(\d+)$/i.exec(input.skillId);
      if(published){
        const {platformDb,publishedLesson}=await import('@/lib/platform-server');
        const lesson=await publishedLesson(platformDb(),published[1]);
        if(lesson.version!==Number(published[2]))return reply({error:'This lesson has changed. Reload it before starting.'},409);
        resolved={id:input.skillId,total:lesson.document.steps.length};
      }
      if(!resolved && !builtin && !published){const skill=getSkill(input.skillId);if(skill?.status==='available')resolved={id:skill.id,total:skill.steps.length};}
      if (!resolved)
        return reply({ error: "This skill is not available yet." }, 404);
      const { data, error } = await db().rpc("claim_coaching_trial", {
        p_user_id: user.id,
        p_skill_id: resolved.id,
        p_total_steps: resolved.total,
      });
      if (error) throw error;
      if (!data || data.completed_at || data.skill_id !== resolved.id)
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
