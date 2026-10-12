"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Check,
  CircleHelp,
} from "lucide-react";
import type { AvailableSkill } from "@/lib/skills/schema";
import {
  createSession,
  sessionReducer,
  type SessionContext,
  type SessionEvent,
} from "@/lib/session/machine";
import { readDraft, saveDraft } from "@/lib/session/draft";
import { AnimatedDiagram } from "./animated-diagram";
import { copy } from "@/lib/copy/en";
export function SessionCoach({
  skill,
  debug,
  graphics,
}: {
  skill: AvailableSkill;
  debug: boolean;
  graphics: Record<string, string>;
}) {
  const [initial, setInitial] = useState<SessionContext | null>(null);
  useEffect(() => {
    setInitial(readDraft(skill) ?? createSession());
  }, [skill]);
  if (!initial)
    return (
      <div className="lesson-loading" role="status">
        {copy.session.reading}
      </div>
    );
  return (
    <HydratedCoach
      skill={skill}
      debug={debug}
      initial={initial}
      graphics={graphics}
    />
  );
}

function HydratedCoach({
  skill,
  debug,
  graphics,
  initial,
}: {
  skill: AvailableSkill;
  debug: boolean;
  graphics: Record<string, string>;
  initial: SessionContext;
}) {
  const [context, dispatch] = useReducer(
    (state: SessionContext, event: SessionEvent) =>
      sessionReducer(state, event, skill),
    initial,
  );
  const [showDemo, setShowDemo] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const step = skill.steps[context.stepIndex];
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [context.stepIndex]);
  useEffect(() => {
    if (context.state === "COMPLETE") completionHeadingRef.current?.focus();
  }, [context.state]);
  useEffect(() => {
    saveDraft(skill, context);
  }, [skill, context]);
  useEffect(() => {
    if (context.state !== "INSTRUCTING" && context.state !== "ADVANCE") return;
    const timer = window.setTimeout(
      () =>
        dispatch({
          type:
            context.state === "INSTRUCTING" ? "INSTRUCTION_FINISHED" : "NEXT",
        }),
      context.state === "ADVANCE" ? 450 : 200,
    );
    return () => window.clearTimeout(timer);
  }, [context.state, context.stepIndex]);
  useEffect(() => {
    setShowDemo(false);
    setRepeatCount(0);
  }, [context.stepIndex]);
  if (context.state === "COMPLETE")
    return (
      <main className="completion-page page-width">
        <div className="completion-symbol" aria-hidden="true">
          <Check size={38} />
        </div>
        <h1
          ref={completionHeadingRef}
          tabIndex={-1}
          aria-label={copy.completion.title.replace("\n", " ")}
        >
          {copy.completion.title.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className="lead">{copy.completion.message}</p>
        <aside className="mode-note">{copy.completion.disclaimer}</aside>
        <div className="completion-columns">
          <section>
            <h2>{copy.completion.summary}</h2>
            <p>{copy.completion.steps(context.records.length)}</p>
            {context.records.some(
              (record) => record.failures || record.uncertaintyRetries,
            ) ? (
              <ul>
                {context.records
                  .filter(
                    (record) => record.failures || record.uncertaintyRetries,
                  )
                  .map((record) => (
                    <li key={record.stepId}>
                      {
                        skill.steps.find((step) => step.id === record.stepId)
                          ?.title
                      }
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="small-note">{copy.completion.noRetries}</p>
            )}
          </section>
          <section>
            <h2>{copy.completion.tips}</h2>
            <ul className="tip-list">
              {skill.completion.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        </div>
        <div className="completion-actions">
          <button
            className="button primary"
            onClick={() => dispatch({ type: "RESTART" })}
          >
            <RotateCcw size={20} aria-hidden="true" />
            {copy.completion.again}
          </button>
          <Link className="button secondary" href="/">
            {copy.common.home}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  return (
    <main className="session-page page-width">
      <div className="session-topline">
        <p className="progress-label">
          {copy.session.progress(context.stepIndex + 1, skill.steps.length)}
        </p>
        <span className="badge">
          <BookOpen size={15} aria-hidden="true" />
          {copy.session.mode}
        </span>
      </div>
      <ol
        className="step-dots"
        aria-label={copy.session.progress(
          context.stepIndex + 1,
          skill.steps.length,
        )}
      >
        {skill.steps.map((item, index) => (
          <li
            key={item.id}
            className={
              index < context.stepIndex
                ? "visited"
                : index === context.stepIndex
                  ? "current"
                  : ""
            }
            aria-current={index === context.stepIndex ? "step" : undefined}
          >
            <span className="sr-only">{item.title}</span>
          </li>
        ))}
      </ol>
      <div className="coaching-layout">
        <section
          className={`demonstration ${showDemo ? "expanded-demo" : ""}`}
          aria-label={step.title}
        >
          <div className="diagram-header">
            <span>{copy.session.diagramLegend}</span>
          </div>
          <AnimatedDiagram
            key={`${step.id}-${repeatCount}`}
            markup={graphics[step.id]}
            src={step.demoAsset}
            label={`${step.title}. ${copy.session.diagramNote}`}
          />
          <p className="diagram-caption">{copy.session.diagramNote}</p>
          {showDemo && (
            <div className="demo-notes">
              <p>{copy.session.demoNote}</p>
              <p>{step.instruction}</p>
            </div>
          )}
        </section>
        <section className="step-panel" aria-labelledby="step-title">
          <h1
            className="step-heading"
            id="step-title"
            key={step.id}
            ref={stepHeadingRef}
            tabIndex={-1}
          >
            {step.title}
          </h1>
          <p className="instruction" key={`instruction-${step.id}`}>
            {step.instruction}
          </p>
          <div
            className="session-status"
            role="status"
            aria-live="polite"
            key={`${context.state}-${repeatCount}`}
          >
            {context.state === "ADVANCE"
              ? context.stepIndex === skill.steps.length - 1
                ? copy.session.finish
                : copy.session.next
              : repeatCount
                ? copy.session.repeatNote
                : copy.session.reading}
          </div>
          <div className="session-buttons">
            <button
              className="button primary"
              disabled={context.state !== "PRACTICING"}
              onClick={() => dispatch({ type: "DONE" })}
            >
              {copy.session.done}
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            <div className="secondary-actions">
              <button
                className="button secondary"
                onClick={() => {
                  dispatch({ type: "REPLAY" });
                  setRepeatCount((count) => count + 1);
                }}
                disabled={context.state === "ADVANCE"}
              >
                <RotateCcw size={19} aria-hidden="true" />
                {copy.session.repeat}
              </button>
              <button
                className="button secondary"
                aria-expanded={showDemo}
                onClick={() => setShowDemo(!showDemo)}
              >
                <BookOpen size={19} aria-hidden="true" />
                {showDemo ? copy.session.closeDemo : copy.session.demo}
              </button>
            </div>
            <button
              className="quiet-link back-step"
              onClick={() => dispatch({ type: "BACK" })}
              disabled={context.stepIndex === 0 || context.state === "ADVANCE"}
            >
              <ArrowLeft size={19} aria-hidden="true" />
              {copy.common.back}
            </button>
          </div>
          <aside className="session-disclosure">
            <CircleHelp size={19} aria-hidden="true" />
            <p>{copy.session.modeDetail}</p>
          </aside>
        </section>
      </div>
      {debug && (
        <details className="debug-panel" open>
          <summary>{copy.session.debug}</summary>
          <pre>{JSON.stringify(context, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
