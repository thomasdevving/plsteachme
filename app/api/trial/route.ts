import { logError } from "@/lib/log";
import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { authenticatedUser } from "@/lib/auth/server";
import { sameOrigin } from "@/lib/auth/redirect";
import { db } from "@/lib/storage";
import { readJSON } from "@/lib/ai/server";
import { trialSkillCatalog } from "@/lib/skills/trial-catalog.generated";
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
  let stage = "authentication";
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
      stage = "resolve_lesson";
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
      // Resolve original coaching IDs from validated, bundled metadata. Build-time
      // discovery still picks up new JSON lessons, without runtime disk access.
      if(!resolved && !builtin && !published){
        const skill=trialSkillCatalog.find(item=>item.id===input.skillId);
        if(skill?.status==='available')resolved={id:skill.id,total:skill.totalSteps};
      }
      if (!resolved)
        return reply({ error: "This skill is not available yet." }, 404);
      stage = "claim_session";
      const { data, error } = await db().rpc("claim_coaching_trial", {
        p_user_id: user.id,
        p_skill_id: resolved.id,
        p_total_steps: resolved.total,
        // One free session per address, also after the account is deleted (stored hashed).
        p_email: user.email ?? null,
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
    stage = "save_progress";
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
  } catch (error) {
    const raw = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const code = typeof raw === 'string' && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(raw) ? raw : 'unknown';
    // Only the stage and standard error code; never IDs, emails, tokens or provider messages.
    logError('trial.save_failed', { stage, code });
    return reply(
      { error: "Your session could not be saved. Please try again." },
      503,
    );
  }
}
