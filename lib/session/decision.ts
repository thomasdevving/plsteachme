import { z } from "zod";
import { copy } from "../copy/en";
import type { SkillStep } from "../skills/schema";
import { SESSION_CONFIG } from "./config";

export const verificationResultSchema = z.object({
  verdict: z.enum(["pass", "fail", "not_visible", "uncertain"]),
  confidence: z.number().min(0).max(1),
  errorId: z.string().nullable(),
  observation: z.string(),
  feedback: z.string(),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type Decision =
  | { state: "PASSED"; feedback: string }
  | { state: "CORRECTING"; feedback: string }
  | { state: "REPOSITION"; feedback: string }
  | { state: "UNCERTAIN"; feedback: string; accepted: boolean };

export function decide(step: SkillStep, input: VerificationResult): Decision {
  const result = verificationResultSchema.parse(input);
  if (result.verdict === "not_visible")
    return { state: "REPOSITION", feedback: step.rubric.notVisibleCue };
  if (
    result.verdict === "pass" &&
    result.confidence >= SESSION_CONFIG.passConfidence
  )
    return { state: "PASSED", feedback: copy.feedback.pass };
  if (
    result.verdict === "fail" &&
    result.errorId &&
    result.confidence >= SESSION_CONFIG.correctionConfidence
  ) {
    const error = step.rubric.commonErrors.find(
      (error) => error.id === result.errorId,
    );
    const feedback = error?.cue || result.feedback;
    // A confident fail still needs a concrete action before we can correct.
    if (feedback.trim())
      return {
        state: "CORRECTING",
        feedback: feedback.trim().split(/\s+/).slice(0, 15).join(" "),
      };
  }
  return {
    state: "UNCERTAIN",
    feedback:
      step.checkStrictness === "light"
        ? copy.feedback.lightUncertain
        : copy.feedback.strictUncertain,
    accepted: step.checkStrictness === "light",
  };
}
