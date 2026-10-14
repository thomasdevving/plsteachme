import { getSkill } from "@/lib/skills/loader";
import { verificationResultSchema } from "@/lib/session/decision";
import { verifyInputSchema } from "@/lib/ai/schemas";
import { verifierPrompt } from "@/lib/ai/prompts";
import {
  client,
  isMock,
  json,
  modelName,
  parseJSON,
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
  const start = Date.now(),
    mock = isMock(),
    model = mock ? "mock" : modelName(input.model);
  let result = {
    verdict: "uncertain" as "pass" | "fail" | "not_visible" | "uncertain",
    confidence: 0,
    errorId: null as string | null,
    observation: "The step could not be checked reliably.",
    feedback: "Hold still and show me once more.",
  };
  if (mock) {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 800));
    const roll = Math.random();
    const error = step.rubric.commonErrors[0];
    result =
      roll < 0.65
        ? {
            verdict: "pass",
            confidence: 0.9,
            errorId: null,
            observation: "Simulated pass; no image assessment took place.",
            feedback: "",
          }
        : roll < 0.82 && error
          ? {
              verdict: "fail",
              confidence: 0.85,
              errorId: error.id,
              observation:
                "Simulated correction; no image assessment took place.",
              feedback: error.cue,
            }
          : roll < 0.9
            ? {
                verdict: "not_visible",
                confidence: 0.8,
                errorId: null,
                observation: "Simulated visibility issue.",
                feedback: step.rubric.notVisibleCue,
              }
            : result;
  } else {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 7000);
    const cancel = () => abort.abort();
    request.signal.addEventListener("abort", cancel, { once: true });
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const message = await client().messages.create(
          {
            model,
            max_tokens: 500,
            system: verifierPrompt(
              skill,
              step,
              input.intake,
              input.frames.length,
            ),
            messages: [
              {
                role: "user",
                content: [
                  ...input.frames.map((data) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "image/jpeg" as const,
                      data,
                    },
                  })),
                  {
                    type: "text",
                    text: `Check this step. Attempt ${input.attemptNumber}. Previous feedback (context only): ${JSON.stringify(input.previousFeedback ?? "")}. ${attempt ? "The previous response was invalid; use only the requested JSON." : ""}`,
                  },
                ],
              },
            ],
          },
          { signal: abort.signal },
        );
        try {
          result = verificationResultSchema.parse(
            parseJSON(
              message.content
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join(""),
            ),
          );
          break;
        } catch {
          /* Retry malformed output once within the same deadline. */
        }
      }
    } catch {
      return json(
        {
          error:
            "The check is unavailable. Try again or continue without verification.",
        },
        503,
      );
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", cancel);
    }
  }
  result.feedback = result.feedback.trim().split(/\s+/).slice(0, 15).join(" ");
  const latencyMs = Date.now() - start;
  console.info("verification", {
    latencyMs,
    verdict: result.verdict,
    confidence: result.confidence,
    errorId: result.errorId,
  });
  return json({ ...result, latencyMs, model, mock });
}
