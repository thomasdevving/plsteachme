import { generateText, Output } from "ai";
import type { NextRequest } from "next/server";
import { requireTrial } from "@/lib/auth/trial";
import { getSkill } from "@/lib/skills/loader";
import { verificationResultSchema } from "@/lib/session/decision";
import { verifyInputSchema } from "@/lib/ai/schemas";
import { verifierPrompt } from "@/lib/ai/prompts";
import { coachingRateAllowed } from "@/lib/coaching-security";
import {
  client,
  decodeFrame,
  isAvailable,
  isMock,
  json,
  modelName,
  providerSignal,
  readJSON,
} from "@/lib/ai/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let input;
  try {
    input = verifyInputSchema.parse(await readJSON(request));
  } catch {
    return json(
      { error: "Please send a valid step and up to three small JPEG frames." },
      400,
    );
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
  if (!coachingRateAllowed(request as NextRequest, "check"))
    return json({ error: "Please wait before checking another step." }, 429);
  let frames: Buffer[];
  try {
    frames = await Promise.all(input.frames.map(decodeFrame));
  } catch {
    return json(
      {
        error:
          "Please send valid JPEG frames smaller than 300 KB and one megapixel.",
      },
      400,
    );
  }
  const start = Date.now();
  if (isMock())
    return json({
      verdict: "uncertain",
      confidence: 0,
      errorId: null,
      observation: "Development simulation; no image assessment took place.",
      feedback:
        "Continue with the illustrated instruction or try a real camera check when connected.",
      latencyMs: Date.now() - start,
      model: "mock",
      mock: true,
    });
  try {
    const response = await generateText({
      model: client().responses(modelName(input.model)),
      system: verifierPrompt(skill, step, input.intake, frames.length),
      output: Output.object({ schema: verificationResultSchema }),
      messages: [
        {
          role: "user",
          content: [
            ...frames.map((image) => ({
              type: "image" as const,
              image,
              mediaType: "image/jpeg" as const,
            })),
            {
              type: "text",
              text: `Check this step. Attempt ${input.attemptNumber}. Previous feedback (context only): ${JSON.stringify(input.previousFeedback ?? "")}.`,
            },
          ],
        },
      ],
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
    const result = verificationResultSchema.parse(response.output);
    return json({
      ...result,
      feedback: result.feedback.trim().split(/\s+/).slice(0, 15).join(" "),
      latencyMs: Date.now() - start,
      model: modelName(input.model),
      mock: false,
    });
  } catch {
    return json(
      {
        error:
          "The check is unavailable. Try again or continue without verification.",
      },
      503,
    );
  }
}
