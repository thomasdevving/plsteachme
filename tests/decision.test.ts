import { describe, expect, it } from "vitest";
import { loadSkills } from "../lib/skills/loader";
import {
  decide,
  verificationResultSchema,
  type VerificationResult,
} from "../lib/session/decision";
import type { AvailableSkill } from "../lib/skills/schema";
const skill = loadSkills().find(
  (skill) => skill.status === "available",
) as AvailableSkill;
const step = skill.steps[0];
const result = (
  overrides: Partial<VerificationResult> = {},
): VerificationResult => ({
  verdict: "pass",
  confidence: 0.9,
  errorId: null,
  observation: "Tie visible.",
  feedback: "Try pulling the wide end lower.",
  ...overrides,
});
describe("conservative verification decisions", () => {
  it("passes at the threshold", () =>
    expect(decide(step, result({ confidence: 0.75 })).state).toBe("PASSED"));
  it("does not pass below the threshold", () =>
    expect(decide(step, result({ confidence: 0.749 })).state).toBe(
      "UNCERTAIN",
    ));
  it("does not correct low-confidence failures", () =>
    expect(
      decide(
        step,
        result({ verdict: "fail", confidence: 0.749, errorId: "ends_equal" }),
      ).state,
    ).toBe("UNCERTAIN"));
  it("requires an error ID to correct", () =>
    expect(decide(step, result({ verdict: "fail" })).state).toBe("UNCERTAIN"));
  it("uses a known cue instead of generated prose", () =>
    expect(
      decide(step, result({ verdict: "fail", errorId: "ends_equal" })).feedback,
    ).toBe(step.rubric.commonErrors[0].cue));
  it("uses model feedback for a clearly different error", () =>
    expect(
      decide(step, result({ verdict: "fail", errorId: "other" })).feedback,
    ).toBe("Try pulling the wide end lower."));
  it("caps corrections at fifteen words", () =>
    expect(
      decide(
        step,
        result({
          verdict: "fail",
          errorId: "other",
          feedback: Array(25).fill("Try").join(" "),
        }),
      ).feedback.split(" "),
    ).toHaveLength(15));
  it("does not correct with empty feedback and an unknown error", () =>
    expect(
      decide(step, result({ verdict: "fail", errorId: "other", feedback: "" }))
        .state,
    ).toBe("UNCERTAIN"));
  it("asks for visibility even at low confidence", () =>
    expect(
      decide(step, result({ verdict: "not_visible", confidence: 0.1 })).state,
    ).toBe("REPOSITION"));
  it("accepts ambiguous light steps without calling them passed", () =>
    expect(
      decide(skill.steps[1], result({ verdict: "uncertain" })),
    ).toMatchObject({ state: "UNCERTAIN", accepted: true }));
  it("never accepts strict uncertainty", () =>
    expect(decide(step, result({ verdict: "uncertain" }))).toMatchObject({
      state: "UNCERTAIN",
      accepted: false,
    }));
  it.each([-1, 1.1, NaN])("rejects invalid confidence %s", (confidence) =>
    expect(
      verificationResultSchema.safeParse(result({ confidence })).success,
    ).toBe(false),
  );
  it("rejects an invented verdict", () =>
    expect(
      verificationResultSchema.safeParse({ ...result(), verdict: "probably" })
        .success,
    ).toBe(false));
});
