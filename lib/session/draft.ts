import { readLocal, writeLocal, removeLocal } from "../storage/store";
import { z } from "zod";
import type { AvailableSkill } from "../skills/schema";
import type { SessionContext } from "./machine";
export const contextSchema: z.ZodType<SessionContext> = z.object({
  state: z.enum([
    "INSTRUCTING",
    "PRACTICING",
    "CAPTURING",
    "VERIFYING",
    "PASSED",
    "CORRECTING",
    "REPOSITION",
    "UNCERTAIN",
    "OPTIONS",
    "ADVANCE",
    "COMPLETE",
  ]),
  stepIndex: z.number().int().nonnegative(),
  mode: z.enum(["walkthrough", "live"]),
  intake: z.record(z.string(), z.string()),
  attemptNumber: z.number().int().nonnegative(),
  failedAttempts: z.number().int().nonnegative(),
  uncertaintyRetries: z.number().int().nonnegative(),
  feedback: z.string(),
  lastVerificationMock: z.boolean().default(false),
  optionReason: z.enum(["attempts", "uncertain", "api_error"]).nullable(),
  records: z.array(
    z.object({
      stepId: z.string(),
      attempts: z.number().int().nonnegative(),
      failures: z.number().int().nonnegative(),
      uncertaintyRetries: z.number().int().nonnegative(),
      outcome: z.enum([
        "verified",
        "accepted_unverified",
        "manual_override",
        "walkthrough",
        "unchecked",
        "simulated",
      ]),
    }),
  ),
});
const draftSchema = z.object({
  skillVersion: z.number(),
  context: contextSchema,
});
const key = (skill: AvailableSkill) => `plsteach.me:lesson:${skill.id}`;
export function readDraft(skill: AvailableSkill): SessionContext | null {
  try {
    const text = sessionStorage.getItem(key(skill));
    if (!text) return null;
    const draft = draftSchema.parse(JSON.parse(text));
    if (
      draft.skillVersion !== skill.version ||
      draft.context.stepIndex >= skill.steps.length ||
      draft.context.mode !== "walkthrough" ||
      !["INSTRUCTING", "PRACTICING", "ADVANCE"].includes(draft.context.state)
    )
      return null;
    if (
      draft.context.records.some(
        (record) => !skill.steps.some((step) => step.id === record.stepId),
      )
    )
      return null;
    return draft.context;
  } catch {
    return null;
  }
}
export function saveDraft(
  skill: AvailableSkill,
  context: SessionContext,
): void {
  if (context.state === "COMPLETE") void removeLocal(`draft:${skill.id}`);
  else
    void writeLocal(`draft:${skill.id}`, {
      skillVersion: skill.version,
      context,
    });
  try {
    if (context.state === "COMPLETE") sessionStorage.removeItem(key(skill));
    else
      sessionStorage.setItem(
        key(skill),
        JSON.stringify({ skillVersion: skill.version, context }),
      );
  } catch {
    /* Storage may be disabled. The lesson still works in memory. */
  }
}

export async function restoreDraft(
  skill: AvailableSkill,
): Promise<SessionContext | null> {
  const persisted = await readLocal<unknown>(`draft:${skill.id}`);
  if (persisted) {
    const parsed = draftSchema.safeParse(persisted);
    if (
      parsed.success &&
      parsed.data.skillVersion === skill.version &&
      parsed.data.context.stepIndex < skill.steps.length &&
      parsed.data.context.state !== "COMPLETE" &&
      parsed.data.context.records.every((r) =>
        skill.steps.some((s) => s.id === r.stepId),
      )
    ) {
      const context = parsed.data.context;
      return {
        ...context,
        state: context.state === "ADVANCE" ? "ADVANCE" : "INSTRUCTING",
      };
    }
  }
  return readDraft(skill);
}
