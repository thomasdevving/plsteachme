import { z } from "zod";
import { getSkill } from "@/lib/skills/loader";
import { askInputSchema } from "@/lib/ai/schemas";
import { askPrompt } from "@/lib/ai/prompts";
import { client, isMock, json, parseJSON, readJSON } from "@/lib/ai/server";
export const runtime = "nodejs";
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
  if (isMock())
    return json({
      answer: step.instruction.split(/\s+/).slice(0, 40).join(" "),
      mock: true,
    });
  try {
    const result = await client().messages.create(
      {
        model: process.env.ASK_MODEL || "claude-haiku-5-5",
        max_tokens: 250,
        system: askPrompt(skill, step, input.intake),
        messages: [{ role: "user", content: input.question }],
      },
      { signal: request.signal },
    );
    const parsed = z.object({ answer: z.string().min(1).max(2000) }).parse(
      parseJSON(
        result.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join(""),
      ),
    );
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
