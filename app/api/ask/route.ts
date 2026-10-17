import { generateText, Output } from "ai";
import type { NextRequest } from "next/server";
import { requireTrial } from "@/lib/auth/trial";
import { z } from "zod";
import { getSkill } from "@/lib/skills/catalog";
import { askInputSchema } from "@/lib/ai/schemas";
import { askPrompt } from "@/lib/ai/prompts";
import { coachingRateAllowed } from "@/lib/coaching-security";
import {
  client,
  isAvailable,
  isMock,
  json,
  modelName,
  providerSignal,
  readJSON,
} from "@/lib/ai/server";
export const runtime = "nodejs";
const answerSchema = z.object({ answer: z.string().min(1).max(2000) });
export async function POST(request: Request) {
  let input;
  try {
    input = askInputSchema.parse(await readJSON(request, 16000));
  } catch {
    return json({ error: "Please ask a short question about this step." }, 400);
  }
  const skill = getSkill(input.skillId);
  if (!skill || skill.status !== "available")
    return json({ error: "Skill not found." }, 404);
  const step = skill.steps.find((s) => s.id === input.stepId);
  if (!step) return json({ error: "Step not found." }, 404);
  const denied = await requireTrial(request, skill.id);
  if (denied) return denied;
  if (!isAvailable())
    return json(
      {
        error:
          "AI coaching is not configured yet. Continue with the illustrated steps.",
      },
      503,
    );
  if (!coachingRateAllowed(request as NextRequest, "question"))
    return json({ error: "Please wait before asking another question." }, 429);
  if (isMock())
    return json({
      answer: step.instruction.split(/\s+/).slice(0, 40).join(" "),
      mock: true,
    });
  try {
    const result = await generateText({
      model: client().responses(modelName(input.model)),
      output: Output.object({ schema: answerSchema }),
      system: askPrompt(skill, step, input.intake),
      messages: [{ role: "user", content: input.question }],
      providerOptions: {
        openai: {
          store: false,
          reasoningEffort: "low",
          reasoningSummary: null,
        },
      },
      maxOutputTokens: 1200,
      maxRetries: 0,
      abortSignal: providerSignal(request),
    });
    const parsed = answerSchema.parse(result.output);
    return json({
      answer: parsed.answer.split(/\s+/).slice(0, 40).join(" "),
      mock: false,
    });
  } catch {
    return json(
      { error: "I couldn’t answer just now. Try again or replay the step." },
      503,
    );
  }
}
