import { copy } from "../copy/en";
import type { AvailableSkill, IntakeAnswers } from "../skills/schema";
import { decide, type VerificationResult } from "./decision";
import { SESSION_CONFIG } from "./config";

export type SessionState =
  | "INSTRUCTING"
  | "PRACTICING"
  | "CAPTURING"
  | "VERIFYING"
  | "PASSED"
  | "CORRECTING"
  | "REPOSITION"
  | "UNCERTAIN"
  | "OPTIONS"
  | "ADVANCE"
  | "COMPLETE";
export type Outcome =
  | "verified"
  | "accepted_unverified"
  | "manual_override"
  | "walkthrough"
  | "unchecked";
export type StepRecord = {
  stepId: string;
  attempts: number;
  failures: number;
  uncertaintyRetries: number;
  outcome: Outcome;
};
export type SessionContext = {
  state: SessionState;
  stepIndex: number;
  mode: "walkthrough" | "live";
  intake: IntakeAnswers;
  attemptNumber: number;
  failedAttempts: number;
  uncertaintyRetries: number;
  feedback: string;
  optionReason: "attempts" | "uncertain" | "api_error" | null;
  records: StepRecord[];
};
export type SessionEvent =
  | {
      type:
        | "INSTRUCTION_FINISHED"
        | "DONE"
        | "CAPTURED"
        | "RETRY"
        | "REPLAY"
        | "BACK"
        | "NEXT"
        | "MANUAL_CONTINUE"
        | "RESTART";
    }
  | { type: "PRECHECK_FAILED"; feedback: string }
  | { type: "VERIFICATION_RECEIVED"; result: VerificationResult }
  | { type: "API_ERROR" };

export function createSession(
  intake: IntakeAnswers = {},
  mode: SessionContext["mode"] = "walkthrough",
): SessionContext {
  return {
    state: "INSTRUCTING",
    stepIndex: 0,
    mode,
    intake,
    attemptNumber: 0,
    failedAttempts: 0,
    uncertaintyRetries: 0,
    feedback: "",
    optionReason: null,
    records: [],
  };
}
function finish(
  context: SessionContext,
  skill: AvailableSkill,
  outcome: Outcome,
): SessionContext {
  return {
    ...context,
    state: "ADVANCE",
    records: [
      ...context.records.filter(
        (record) => record.stepId !== skill.steps[context.stepIndex].id,
      ),
      {
        stepId: skill.steps[context.stepIndex].id,
        attempts: context.attemptNumber,
        failures: context.failedAttempts,
        uncertaintyRetries: context.uncertaintyRetries,
        outcome,
      },
    ],
  };
}
export function sessionReducer(
  context: SessionContext,
  event: SessionEvent,
  skill: AvailableSkill,
): SessionContext {
  const step = skill.steps[context.stepIndex];
  if (event.type === "RESTART")
    return createSession(context.intake, context.mode);
  if (context.state === "COMPLETE") return context;
  if (
    event.type === "BACK" &&
    context.stepIndex > 0 &&
    !["CAPTURING", "VERIFYING"].includes(context.state)
  ) {
    return {
      ...createSession(context.intake, context.mode),
      stepIndex: context.stepIndex - 1,
      records: context.records.filter(
        (record) =>
          skill.steps.findIndex((step) => step.id === record.stepId) <
          context.stepIndex - 1,
      ),
    };
  }
  switch (event.type) {
    case "INSTRUCTION_FINISHED":
      return context.state === "INSTRUCTING"
        ? { ...context, state: "PRACTICING" }
        : context;
    case "DONE": {
      if (context.state !== "PRACTICING") return context;
      if (context.mode === "walkthrough")
        return finish(context, skill, "walkthrough");
      if (step.checkStrictness === "none")
        return finish(context, skill, "unchecked");
      return {
        ...context,
        state: "CAPTURING",
        attemptNumber: context.attemptNumber + 1,
        feedback: "",
      };
    }
    case "PRECHECK_FAILED":
      return context.state === "CAPTURING"
        ? { ...context, state: "REPOSITION", feedback: event.feedback }
        : context;
    case "CAPTURED":
      return context.state === "CAPTURING"
        ? { ...context, state: "VERIFYING" }
        : context;
    case "VERIFICATION_RECEIVED": {
      if (context.state !== "VERIFYING") return context;
      const decision = decide(step, event.result);
      if (decision.state === "CORRECTING") {
        const failedAttempts = context.failedAttempts + 1;
        return {
          ...context,
          failedAttempts,
          feedback: decision.feedback,
          state: failedAttempts >= step.maxAttempts ? "OPTIONS" : "CORRECTING",
          optionReason: failedAttempts >= step.maxAttempts ? "attempts" : null,
        };
      }
      if (decision.state === "UNCERTAIN") {
        if (decision.accepted)
          return {
            ...context,
            state: "UNCERTAIN",
            feedback: decision.feedback,
          };
        const exhausted =
          context.uncertaintyRetries >= SESSION_CONFIG.maxUncertaintyRetries;
        return {
          ...context,
          state: exhausted ? "OPTIONS" : "UNCERTAIN",
          feedback: decision.feedback,
          optionReason: exhausted ? "uncertain" : null,
        };
      }
      return { ...context, state: decision.state, feedback: decision.feedback };
    }
    case "API_ERROR":
      return ["VERIFYING", "CAPTURING"].includes(context.state)
        ? {
            ...context,
            state: "OPTIONS",
            optionReason: "api_error",
            feedback: copy.feedback.apiError,
          }
        : context;
    case "RETRY": {
      if (
        !["CORRECTING", "REPOSITION", "UNCERTAIN", "OPTIONS"].includes(
          context.state,
        )
      )
        return context;
      return {
        ...context,
        state: "PRACTICING",
        uncertaintyRetries:
          context.state === "UNCERTAIN" && step.checkStrictness === "strict"
            ? context.uncertaintyRetries + 1
            : context.uncertaintyRetries,
        feedback: "",
        optionReason: null,
      };
    }
    case "REPLAY":
      return ["CAPTURING", "VERIFYING", "ADVANCE"].includes(context.state)
        ? context
        : { ...context, state: "INSTRUCTING", feedback: "" };
    case "MANUAL_CONTINUE":
      return context.state === "OPTIONS"
        ? finish(context, skill, "manual_override")
        : context;
    case "NEXT": {
      if (context.state === "PASSED") return finish(context, skill, "verified");
      if (context.state === "UNCERTAIN" && step.checkStrictness === "light")
        return finish(context, skill, "accepted_unverified");
      if (context.state !== "ADVANCE") return context;
      if (context.stepIndex === skill.steps.length - 1)
        return { ...context, state: "COMPLETE" };
      return {
        ...createSession(context.intake, context.mode),
        stepIndex: context.stepIndex + 1,
        records: context.records,
      };
    }
    default:
      return context;
  }
}
