import { describe, expect, it } from "vitest";
import { loadSkills } from "../lib/skills/loader";
import {
  createSession,
  sessionReducer,
  type SessionContext,
  type SessionEvent,
} from "../lib/session/machine";
import type { AvailableSkill } from "../lib/skills/schema";
import type { VerificationResult } from "../lib/session/decision";
const skill = loadSkills().find(
  (skill) => skill.status === "available",
) as AvailableSkill;
const result = (
  verdict: VerificationResult["verdict"],
  confidence = 0.9,
  errorId: string | null = null,
): VerificationResult => ({
  verdict,
  confidence,
  errorId,
  observation: "A tie is visible.",
  feedback: "Try pulling the wide end lower.",
});
const reduce = (
  context: SessionContext,
  event: SessionEvent,
  definition = skill,
) => sessionReducer(context, event, definition);
function practicing(index = 0) {
  return {
    ...createSession({ hand: "Right" }, "live"),
    stepIndex: index,
    state: "PRACTICING" as const,
  };
}
function verifying(context: SessionContext = practicing()): SessionContext {
  return reduce(reduce(context, { type: "DONE" }), { type: "CAPTURED" });
}
function check(
  context: SessionContext,
  verdict: VerificationResult["verdict"],
  errorId: string | null = null,
): SessionContext {
  return reduce(verifying(context), {
    type: "VERIFICATION_RECEIVED",
    result: result(verdict, 0.9, errorId),
  });
}

describe("coaching state machine", () => {
  it("starts instructing and retains intake context", () => {
    const initial = createSession({ hand: "Left" });
    expect(initial.state).toBe("INSTRUCTING");
    expect(initial.intake.hand).toBe("Left");
    expect(reduce(initial, { type: "INSTRUCTION_FINISHED" }).state).toBe(
      "PRACTICING",
    );
  });
  it("walks through all seven steps without inventing verification", () => {
    let context = createSession();
    for (let index = 0; index < 7; index++) {
      expect(context.stepIndex).toBe(index);
      context = reduce(context, { type: "INSTRUCTION_FINISHED" });
      context = reduce(context, { type: "DONE" });
      expect(context.state).toBe("ADVANCE");
      expect(context.records[index].outcome).toBe("walkthrough");
      context = reduce(context, { type: "NEXT" });
    }
    expect(context.state).toBe("COMPLETE");
    expect(context.records).toHaveLength(7);
    expect(context.records.every((record) => record.attempts === 0)).toBe(true);
  });
  it("captures then verifies a live attempt", () => {
    const capture = reduce(practicing(), { type: "DONE" });
    expect(capture.state).toBe("CAPTURING");
    expect(capture.attemptNumber).toBe(1);
    expect(reduce(capture, { type: "CAPTURED" }).state).toBe("VERIFYING");
  });
  it("repositions on local failure without entering verification", () => {
    const capture = reduce(practicing(), { type: "DONE" });
    const reposition = reduce(capture, {
      type: "PRECHECK_FAILED",
      feedback: "Step back a little.",
    });
    expect(reposition.state).toBe("REPOSITION");
    expect(reposition.feedback).toBe("Step back a little.");
    expect(reduce(reposition, { type: "RETRY" }).state).toBe("PRACTICING");
  });
  it("passes only after receiving a confident verdict", () => {
    const passed = check(practicing(), "pass");
    expect(passed.state).toBe("PASSED");
    const advance = reduce(passed, { type: "NEXT" });
    expect(advance.records[0].outcome).toBe("verified");
    expect(reduce(advance, { type: "NEXT" }).stepIndex).toBe(1);
  });
  it("gives the authored correction and counts failures", () => {
    const correction = check(practicing(), "fail", "ends_equal");
    expect(correction.state).toBe("CORRECTING");
    expect(correction.failedAttempts).toBe(1);
    expect(correction.feedback).toBe(skill.steps[0].rubric.commonErrors[0].cue);
    expect(reduce(correction, { type: "RETRY" }).state).toBe("PRACTICING");
  });
  it("offers replay and a logged override after maxAttempts", () => {
    let context: SessionContext = practicing();
    for (let i = 0; i < 3; i++) {
      context = check(context, "fail", "ends_equal");
      if (i < 2) context = reduce(context, { type: "RETRY" });
    }
    expect(context.state).toBe("OPTIONS");
    expect(context.optionReason).toBe("attempts");
    expect(context.failedAttempts).toBe(3);
    expect(reduce(context, { type: "REPLAY" }).state).toBe("INSTRUCTING");
    const advance = reduce(context, { type: "MANUAL_CONTINUE" });
    expect(advance.records[0]).toMatchObject({
      outcome: "manual_override",
      failures: 3,
      attempts: 3,
    });
  });
  it("replaying does not reset failures or bypass uncertainty limits", () => {
    let context = check(practicing(), "fail", "ends_equal");
    context = reduce(context, { type: "REPLAY" });
    expect(context.failedAttempts).toBe(1);
    expect(
      reduce(context, { type: "INSTRUCTION_FINISHED" }).failedAttempts,
    ).toBe(1);
  });
  it("repositions on model not_visible, including light steps", () => {
    for (const index of [0, 1])
      expect(check(practicing(index), "not_visible").state).toBe("REPOSITION");
  });
  it("strict steps allow two uncertainty retries, then options", () => {
    let context: SessionContext = practicing();
    for (let i = 0; i < 3; i++) {
      context = check(context, "uncertain");
      if (i < 2) {
        expect(context.state).toBe("UNCERTAIN");
        expect(reduce(context, { type: "NEXT" })).toBe(context);
        context = reduce(context, { type: "RETRY" });
      }
    }
    expect(context.state).toBe("OPTIONS");
    expect(context.uncertaintyRetries).toBe(2);
    expect(context.optionReason).toBe("uncertain");
    expect(
      reduce(context, { type: "MANUAL_CONTINUE" }).records[0].outcome,
    ).toBe("manual_override");
  });
  it("accepts light uncertainty without claiming a verified pass", () => {
    const uncertain = check(practicing(1), "uncertain");
    expect(uncertain.state).toBe("UNCERTAIN");
    const advance = reduce(uncertain, { type: "NEXT" });
    expect(advance.records[0].outcome).toBe("accepted_unverified");
  });
  it("light steps still correct clear errors", () => {
    const correction = check(practicing(1), "fail", "crossed_behind");
    expect(correction.state).toBe("CORRECTING");
  });
  it("none steps bypass capture and record no check", () => {
    const custom = structuredClone(skill);
    custom.steps[0].checkStrictness = "none";
    const advance = reduce(practicing(), { type: "DONE" }, custom);
    expect(advance.state).toBe("ADVANCE");
    expect(advance.records[0].outcome).toBe("unchecked");
  });
  it.each([0, 1])(
    "API errors offer retry or override even on step %i",
    (index) => {
      const error = reduce(verifying(practicing(index)), { type: "API_ERROR" });
      expect(error.state).toBe("OPTIONS");
      expect(error.optionReason).toBe("api_error");
      expect(reduce(error, { type: "RETRY" }).state).toBe("PRACTICING");
      expect(
        reduce(error, { type: "MANUAL_CONTINUE" }).records[0].outcome,
      ).toBe("manual_override");
    },
  );
  it("resets per-step counters after advancing", () => {
    const advance = reduce(
      check(
        { ...practicing(), failedAttempts: 1, uncertaintyRetries: 1 },
        "pass",
      ),
      { type: "NEXT" },
    );
    const next = reduce(advance, { type: "NEXT" });
    expect(next).toMatchObject({
      attemptNumber: 0,
      failedAttempts: 0,
      uncertaintyRetries: 0,
      stepIndex: 1,
    });
    expect(next.records).toHaveLength(1);
    expect(next.intake.hand).toBe("Right");
  });
  it("back clears stale outcomes for the step being revisited", () => {
    let context = createSession();
    for (let i = 0; i < 2; i++) {
      context = reduce(context, { type: "INSTRUCTION_FINISHED" });
      context = reduce(context, { type: "DONE" });
      context = reduce(context, { type: "NEXT" });
    }
    expect(context.records).toHaveLength(2);
    context = reduce(context, { type: "BACK" });
    expect(context.stepIndex).toBe(1);
    expect(context.records.map((record) => record.stepId)).toEqual(["drape"]);
  });
  it("cannot move back before the first step or during verification", () => {
    const first = practicing();
    expect(reduce(first, { type: "BACK" })).toBe(first);
    const busy = verifying(practicing(2));
    expect(reduce(busy, { type: "BACK" })).toBe(busy);
  });
  it("completed sessions only accept restart", () => {
    const complete = { ...createSession(), state: "COMPLETE" as const };
    expect(reduce(complete, { type: "DONE" })).toBe(complete);
    expect(reduce(complete, { type: "BACK" })).toBe(complete);
    expect(reduce(complete, { type: "RESTART" }).state).toBe("INSTRUCTING");
  });
  it("restart clears attempts and records, retaining mode and intake", () => {
    const context = { ...practicing(), failedAttempts: 2 };
    expect(reduce(context, { type: "RESTART" })).toEqual(
      createSession({ hand: "Right" }, "live"),
    );
  });
  it("does not double-count repeated verification responses", () => {
    const corrected = check(practicing(), "fail", "ends_equal");
    expect(
      reduce(corrected, {
        type: "VERIFICATION_RECEIVED",
        result: result("fail", 0.9, "ends_equal"),
      }),
    ).toBe(corrected);
  });
  it.each([
    "INSTRUCTION_FINISHED",
    "DONE",
    "CAPTURED",
    "RETRY",
    "MANUAL_CONTINUE",
    "NEXT",
  ] as const)("ignores invalid %s during verification", (type) => {
    const busy = verifying();
    expect(reduce(busy, { type })).toBe(busy);
  });
  it("finishes the final verified step", () => {
    let context = check(practicing(6), "pass");
    context = reduce(context, { type: "NEXT" });
    expect(context.records[0].outcome).toBe("verified");
    expect(reduce(context, { type: "NEXT" }).state).toBe("COMPLETE");
  });
});
