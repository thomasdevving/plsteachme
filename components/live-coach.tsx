"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Check,
} from "lucide-react";
import type { AvailableSkill } from "@/lib/skills/schema";
import {
  createSession,
  sessionReducer,
  type SessionContext,
  type SessionEvent,
} from "@/lib/session/machine";
import { saveDraft } from "@/lib/session/draft";
import { SESSION_CONFIG as config } from "@/lib/session/config";
import {
  checks,
  isStill,
  movement,
  type HandSample,
  type LandmarkFrame,
} from "@/lib/vision/prechecks";
import { getROI } from "@/lib/vision/roi";
import { captureFrames } from "@/lib/vision/capture";
import { speak, stopSpeech } from "@/lib/speech/tts";
import { parseCommand, recognitionConstructor } from "@/lib/speech/commands";
import {
  verificationResponseSchema,
  askResponseSchema,
} from "@/lib/ai/schemas";
import {
  completeSession,
  writeLocal,
  labelEval,
  type EvalRecord,
} from "@/lib/storage/store";
import { copy, liveCopy as c } from "@/lib/copy/en";
import { CameraView } from "./camera-view";
import { AnimatedDiagram } from "./animated-diagram";
import { EvalPanel } from "./eval-panel";
export function LiveCoach({
  skill,
  initial,
  graphics,
  debug,
  onExit,
}: {
  skill: AvailableSkill;
  initial: SessionContext;
  graphics: Record<string, string>;
  debug: boolean;
  onExit: (context: SessionContext) => void;
}) {
  const [context, dispatch] = useReducer(
    (s: SessionContext, e: SessionEvent) => sessionReducer(s, e, skill),
    { ...initial, mode: "live" },
  );
  const [setup, setSetup] = useState(true),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [cameraKey, setCameraKey] = useState(0),
    [frame, setFrame] = useState<LandmarkFrame | null>(null),
    [demo, setDemo] = useState(false),
    [replay, setReplay] = useState(0),
    [slow, setSlow] = useState(false),
    [mock, setMock] = useState<boolean | null>(null),
    [model, setModel] = useState<"sonnet" | "haiku">("sonnet"),
    [saveFrames, setSaveFrames] = useState(false),
    [evalRecord, setEvalRecord] = useState<EvalRecord | null>(null),
    [frames, setFrames] = useState<string[]>([]),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [asking, setAsking] = useState(false),
    [voice, setVoice] = useState(false),
    [voiceSupported, setVoiceSupported] = useState(false),
    [voiceError, setVoiceError] = useState(""),
    [storageError, setStorageError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    lastFrame = useRef<LandmarkFrame | null>(null),
    readySince = useRef<number | null>(null),
    history = useRef<HandSample[]>([]),
    movingMs = useRef(0),
    lastHint = useRef(0),
    active = useRef(true),
    operation = useRef<AbortController | null>(null),
    qa = useRef<AbortController | null>(null),
    sessionId = useRef(""),
    logged = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const previousFeedback = useRef("");
  useEffect(() => {
    if (context.feedback) previousFeedback.current = context.feedback;
  }, [context.feedback]);
  const current = useRef(context);
  current.current = context;
  const step = skill.steps[context.stepIndex];
  const busy = ["CAPTURING", "VERIFYING", "ADVANCE"].includes(context.state);
  const blocked = paused || !!error;
  useEffect(() => {
    active.current = true;
    sessionId.current = crypto.randomUUID();
    setVoiceSupported(!!recognitionConstructor());
    fetch("/api/config")
      .then((r) => r.json())
      .then((v) => {
        if (active.current) setMock(v.mock === true);
      })
      .catch(() => {});
    return () => {
      active.current = false;
      operation.current?.abort();
      qa.current?.abort();
      stopSpeech();
    };
  }, []);
  useEffect(() => {
    saveDraft(skill, context);
  }, [skill, context]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setPaused(true);
        setVoice(false);
        operation.current?.abort();
        qa.current?.abort();
        stopSpeech();
        if (["CAPTURING", "VERIFYING"].includes(current.current.state))
          dispatch({ type: "API_ERROR" });
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    history.current = [];
    movingMs.current = 0;
    heading.current?.focus({ preventScroll: true });
    setDemo(false);
    setAnswer("");
    qa.current?.abort();
  }, [context.stepIndex]);
  useEffect(() => {
    if (setup || blocked) return;
    let cancelled = false;
    async function run() {
      if (context.state === "INSTRUCTING") {
        await speak(step.spokenInstruction, slow ? 0.7 : 0.95);
        if (!cancelled) dispatch({ type: "INSTRUCTION_FINISHED" });
      } else if (context.state === "ADVANCE") {
        dispatch({ type: "NEXT" });
      } else if (
        context.state === "PASSED" ||
        (context.state === "UNCERTAIN" && step.checkStrictness === "light")
      ) {
        await speak(context.lastVerificationMock ? c.mock : context.feedback);
        if (!cancelled) dispatch({ type: "NEXT" });
      } else if (
        ["CORRECTING", "REPOSITION", "UNCERTAIN", "OPTIONS"].includes(
          context.state,
        )
      ) {
        await speak(context.feedback);
        if (!cancelled && context.state !== "OPTIONS")
          dispatch({ type: "RETRY" });
      }
    }
    void run();
    return () => {
      cancelled = true;
      stopSpeech();
    };
  }, [
    context.state,
    context.stepIndex,
    context.feedback,
    context.lastVerificationMock,
    setup,
    blocked,
    step,
    slow,
  ]);
  useEffect(() => {
    if (context.state !== "CAPTURING" || blocked || setup) return;
    const abort = new AbortController();
    operation.current = abort;
    async function verify() {
      const f = lastFrame.current;
      const local = f ? checks(f, skill.cameraSetup.minLuminance) : null;
      if (
        !f ||
        performance.now() - f.time > config.frameFreshnessMs ||
        f.ambiguous ||
        !local?.enoughLight ||
        !step.localPrechecks.every((name) => local[name])
      ) {
        dispatch({
          type: "PRECHECK_FAILED",
          feedback: f?.ambiguous
            ? c.alone
            : !local?.enoughLight
              ? c.dark
              : step.rubric.notVisibleCue,
        });
        return;
      }
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let speaking: ReturnType<typeof setTimeout> | undefined;
      try {
        const images = await captureFrames(
          video.current!,
          getROI(f),
          abort.signal,
        );
        if (abort.signal.aborted) return;
        const latest = lastFrame.current;
        const finalChecks = latest
          ? checks(latest, skill.cameraSetup.minLuminance)
          : null;
        if (
          !latest ||
          performance.now() - latest.time > config.frameFreshnessMs ||
          latest.ambiguous ||
          !finalChecks?.enoughLight ||
          !step.localPrechecks.every((name) => finalChecks[name])
        ) {
          dispatch({ type: "PRECHECK_FAILED", feedback: c.frame });
          return;
        }
        setFrames(images);
        dispatch({ type: "CAPTURED" });
        const start = performance.now();
        timeout = setTimeout(() => abort.abort(), config.apiTimeoutMs);
        speaking = setTimeout(() => void speak(c.looking), 1800);
        const response = await fetch("/api/verify-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            skillId: skill.id,
            stepId: step.id,
            frames: images,
            intake: context.intake,
            attemptNumber: context.attemptNumber,
            previousFeedback: previousFeedback.current,
            model,
          }),
        });
        if (!response.ok) throw new Error("api");
        const result = verificationResponseSchema.parse(await response.json());
        clearTimeout(speaking);
        stopSpeech();
        setMock(result.mock);
        const record: EvalRecord = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          skillId: skill.id,
          stepId: step.id,
          result,
          clientLatencyMs: performance.now() - start,
          ...(saveFrames ? { frames: images } : {}),
        };
        setEvalRecord(record);
        if (debug && !(await writeLocal(`eval:${record.id}`, record)))
          setStorageError(c.storageError);
        if (active.current && !abort.signal.aborted)
          dispatch({
            type: "VERIFICATION_RECEIVED",
            result,
            mock: result.mock,
          });
      } catch {
        if (active.current) dispatch({ type: "API_ERROR" });
      } finally {
        clearTimeout(timeout);
        clearTimeout(speaking);
      }
    }
    void verify();
    // The same operation owns CAPTURING and VERIFYING; do not abort on that transition.
  }, [context.state, blocked, setup]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (context.state === "COMPLETE" && !logged.current) {
      logged.current = true;
      setVoice(false);
      void completeSession(
        sessionId.current,
        skill,
        context,
        mock !== false,
      ).then((ok) => {
        if (!ok) setStorageError(c.storageError);
      });
    }
  }, [context, skill, mock]);
  async function ask(text = question) {
    if (!text.trim() || asking || busy) return;
    qa.current?.abort();
    const abort = new AbortController();
    qa.current = abort;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 8000);
    setAsking(true);
    setAnswer("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          skillId: skill.id,
          stepId: step.id,
          intake: context.intake,
          question: text,
        }),
      });
      if (!response.ok) throw new Error("api");
      const result = askResponseSchema.parse(await response.json());
      if (active.current && !abort.signal.aborted) {
        setAnswer(result.answer);
        void speak(result.answer);
      }
    } catch {
      if (active.current && (!abort.signal.aborted || timedOut))
        setAnswer(c.askError);
    } finally {
      clearTimeout(timeout);
      if (active.current) setAsking(false);
    }
  }
  const voiceAction = useRef((text: string) => {});
  voiceAction.current = (text) => {
    const parsed = parseCommand(text);
    if (!parsed) return;
    if ("question" in parsed) {
      void ask(parsed.question);
      return;
    }
    switch (parsed.command) {
      case "done":
        dispatch({ type: "DONE" });
        break;
      case "repeat":
        dispatch({ type: "REPLAY" });
        setReplay((n) => n + 1);
        break;
      case "back":
        dispatch({ type: "BACK" });
        break;
      case "show":
        setDemo(true);
        break;
      case "help":
        setDemo(true);
        void speak(step.spokenInstruction);
        break;
    }
  };
  useEffect(() => {
    if (!voice || setup || blocked || context.state !== "PRACTICING") return;
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    let cancelled = false;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language.startsWith("nl") ? "nl-NL" : "en-US";
    recognition.onresult = (e) => {
      if (!window.speechSynthesis?.speaking)
        voiceAction.current(e.results[e.resultIndex][0].transcript);
    };
    recognition.onerror = () => {
      setVoiceError(c.micFailed);
      setVoice(false);
    };
    recognition.onend = () => {
      if (!cancelled)
        try {
          recognition.start();
        } catch {
          setVoice(false);
        }
    };
    try {
      recognition.start();
    } catch {
      setVoice(false);
      setVoiceError(c.micFailed);
    }
    return () => {
      cancelled = true;
      recognition.onend = null;
      recognition.abort();
    };
  }, [voice, setup, blocked, context.state]);
  function onFrame(f: LandmarkFrame) {
    lastFrame.current = f;
    setFrame(f);
    const local = checks(f, skill.cameraSetup.minLuminance);
    if (setup) {
      const ready =
        local.bothShouldersVisible &&
        local.neckRegionVisible &&
        local.bothHandsVisible &&
        local.enoughLight &&
        !f.ambiguous;
      if (ready) {
        readySince.current ??= f.time;
        if (f.time - readySince.current >= config.setupStableMs) {
          setSetup(false);
          stopSpeech();
        }
      } else {
        readySince.current = null;
        if (f.time - lastHint.current > 6500) {
          lastHint.current = f.time;
          void speak(
            f.ambiguous ? c.alone : !local.enoughLight ? c.dark : c.frame,
          );
        }
      }
      return;
    }
    if (
      context.state !== "PRACTICING" ||
      blocked ||
      asking ||
      window.speechSynthesis?.speaking
    ) {
      history.current = [];
      movingMs.current = 0;
      return;
    }
    if (!local.bothHandsVisible || f.ambiguous) {
      history.current = [];
      movingMs.current = 0;
      return;
    }
    const sample = { time: f.time, hands: f.hands };
    const previous = history.current.at(-1);
    if (previous && movement(previous, sample) > config.movementThreshold)
      movingMs.current += Math.min(150, f.time - previous.time);
    history.current = [
      ...history.current.filter((s) => f.time - s.time < 2000),
      sample,
    ];
    if (
      movingMs.current >= config.minimumMovementMs &&
      isStill(history.current)
    ) {
      movingMs.current = 0;
      history.current = [];
      dispatch({ type: "DONE" });
    }
  }
  function pause() {
    setPaused(true);
    setVoice(false);
    operation.current?.abort();
    qa.current?.abort();
    stopSpeech();
  }
  function retry() {
    history.current = [];
    movingMs.current = 0;
    dispatch({ type: "RETRY" });
  }
  if (context.state === "COMPLETE")
    return (
      <main className="page-width completion-page">
        <div className="completion-symbol">
          <Check />
        </div>
        <h1>{c.finished}</h1>
        <p className="lead">
          {mock !== false
            ? c.mockFinished
            : context.records.at(-1)?.outcome === "verified"
              ? c.checked
              : c.unverified}
        </p>
        <h2>{copy.completion.summary}</h2>
        <ul className="result-list">
          {context.records.map((r) => (
            <li key={r.stepId}>
              <strong>
                {skill.steps.find((s) => s.id === r.stepId)?.title}
              </strong>
              <span>
                {r.outcome === "verified"
                  ? copy.completion.verified
                  : r.outcome === "simulated"
                    ? c.mock
                    : copy.completion.manual}{" "}
                · {c.checksCount(r.attempts, r.failures)}
              </span>
            </li>
          ))}
        </ul>
        <h2>{copy.completion.tips}</h2>
        <ul className="tip-list">
          {skill.completion.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p role="status">{storageError}</p>
        <div className="completion-actions">
          <button
            className="button primary"
            onClick={() => {
              sessionId.current = crypto.randomUUID();
              logged.current = false;
              setSetup(true);
              setEvalRecord(null);
              setFrames([]);
              dispatch({ type: "RESTART" });
            }}
          >
            {copy.completion.again}
          </button>
          <Link className="button secondary" href="/progress">
            {c.progress}
          </Link>
          <Link className="quiet-link" href="/">
            {copy.common.home}
          </Link>
        </div>
        {debug && (
          <EvalPanel
            key={evalRecord?.id}
            record={evalRecord}
            frames={frames}
            step={skill.steps.find((s) => s.id === evalRecord?.stepId) ?? step}
            state={context.state}
            prechecks={null}
            model={model}
            setModel={setModel}
            saveFrames={saveFrames}
            setSaveFrames={setSaveFrames}
          />
        )}
      </main>
    );
  const prechecks = frame
    ? checks(frame, skill.cameraSetup.minLuminance)
    : null;
  return (
    <main className="page-width live-session">
      <div className="session-topline">
        <p>
          {setup
            ? c.setupTitle
            : copy.session.progress(context.stepIndex + 1, skill.steps.length)}
        </p>
        <span className="badge">
          {mock === null ? c.connecting : mock ? c.mock : c.live}
        </span>
      </div>
      <div className="live-layout">
        <section>
          <CameraView
            key={cameraKey}
            videoRef={video}
            onFrame={onFrame}
            onError={(message) => {
              setError(message);
              operation.current?.abort();
              qa.current?.abort();
              stopSpeech();
              if (["CAPTURING", "VERIFYING"].includes(current.current.state))
                dispatch({ type: "API_ERROR" });
            }}
            debug={debug}
            paused={blocked}
            setup={setup}
          />
          <p className="small-note">{c.modeDetail}</p>
          <div className="secondary-actions">
            <button
              className="button secondary"
              onClick={() => onExit(context)}
            >
              {c.stop}
            </button>
            <button
              className="button secondary"
              disabled={!!error}
              onClick={() => (paused ? setPaused(false) : pause())}
            >
              {paused ? c.resume : c.pause}
            </button>
          </div>
        </section>
        <section className="live-panel">
          {error ? (
            <>
              <h1>{c.setupTitle}</h1>
              <p role="alert">{error}</p>
              <button
                className="button primary"
                onClick={() => {
                  setError("");
                  readySince.current = null;
                  setSetup(true);
                  setCameraKey((n) => n + 1);
                }}
              >
                {c.retryCamera}
              </button>
              <button
                className="button secondary"
                onClick={() => onExit(context)}
              >
                {c.watch}
              </button>
            </>
          ) : setup ? (
            <>
              <h1>{c.setupTitle}</h1>
              <p className="instruction">{skill.cameraSetup.instruction}</p>
              <ul className="setup-checklist">
                {(
                  [
                    ["bothShouldersVisible", c.shoulders],
                    ["neckRegionVisible", c.neck],
                    ["bothHandsVisible", c.hands],
                    ["enoughLight", c.light],
                  ] as const
                ).map(([key, label]) => (
                  <li key={key} data-ready={prechecks?.[key]}>
                    <Check size={20} />
                    {label}
                    <span>
                      {prechecks?.[key] ? c.readyCheck : c.adjustCheck}
                    </span>
                  </li>
                ))}
              </ul>
              <p role="status">{frame?.ambiguous ? c.alone : c.stable}</p>
            </>
          ) : (
            <>
              <ol
                className="step-dots"
                aria-label={copy.session.progress(
                  context.stepIndex + 1,
                  skill.steps.length,
                )}
              >
                {skill.steps.map((s, i) => (
                  <li
                    key={s.id}
                    className={
                      i < context.stepIndex
                        ? "visited"
                        : i === context.stepIndex
                          ? "current"
                          : ""
                    }
                    aria-current={i === context.stepIndex ? "step" : undefined}
                  >
                    <span className="sr-only">{s.title}</span>
                  </li>
                ))}
              </ol>
              <h1 ref={heading} tabIndex={-1} className="step-heading">
                {step.title}
              </h1>
              <p className="instruction">{step.instruction}</p>
              <div className={`live-diagram ${slow ? "slow-demo" : ""}`}>
                <AnimatedDiagram
                  key={`${step.id}-${replay}`}
                  markup={graphics[step.id]}
                  src={step.demoAsset}
                  label={step.title}
                />
              </div>
              {demo && (
                <div className="demo-notes">
                  <p>{copy.session.demoNote}</p>
                  <p>{step.instruction}</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSlow(true);
                      setReplay((n) => n + 1);
                      dispatch({ type: "REPLAY" });
                    }}
                  >
                    {c.slow}
                  </button>
                </div>
              )}
              <p className="session-status" role="status">
                {paused
                  ? c.paused
                  : context.state === "VERIFYING"
                    ? copy.session.checking
                    : context.feedback || c.ready}
              </p>
              <div className="session-buttons">
                {["CORRECTING", "REPOSITION", "UNCERTAIN", "OPTIONS"].includes(
                  context.state,
                ) &&
                !(
                  context.state === "UNCERTAIN" &&
                  step.checkStrictness === "light"
                ) ? (
                  <button
                    className="button primary"
                    disabled={blocked}
                    onClick={retry}
                  >
                    {copy.session.retry}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={
                      context.state !== "PRACTICING" || blocked || asking
                    }
                    onClick={() => dispatch({ type: "DONE" })}
                  >
                    {copy.session.done}
                    <ArrowRight size={20} />
                  </button>
                )}
                {context.state === "OPTIONS" && (
                  <button
                    className="button secondary"
                    disabled={blocked}
                    onClick={() => {
                      if (debug && evalRecord?.stepId === step.id)
                        void labelEval(evalRecord.id, { manualOverride: true });
                      dispatch({ type: "MANUAL_CONTINUE" });
                    }}
                  >
                    {copy.session.override}
                  </button>
                )}
                <div className="secondary-actions">
                  <button
                    className="button secondary"
                    disabled={busy || blocked}
                    onClick={() => {
                      setReplay((n) => n + 1);
                      dispatch({ type: "REPLAY" });
                    }}
                  >
                    <RotateCcw size={18} />
                    {copy.session.repeat}
                  </button>
                  <button
                    className="button secondary"
                    aria-expanded={demo}
                    onClick={() => setDemo((v) => !v)}
                  >
                    <BookOpen size={18} />
                    {copy.session.demo}
                  </button>
                </div>
                <button
                  className="quiet-link"
                  disabled={context.stepIndex === 0 || busy || blocked}
                  onClick={() => dispatch({ type: "BACK" })}
                >
                  {copy.common.back}
                </button>
                {voiceSupported && (
                  <button
                    className="button secondary"
                    disabled={busy || blocked}
                    aria-pressed={voice}
                    onClick={() => setVoice((v) => !v)}
                  >
                    {voice ? <MicOff size={18} /> : <Mic size={18} />}{" "}
                    {voice ? c.micOff : c.listen}
                  </button>
                )}
                <p className="small-note">
                  {voiceError || (voice ? c.listening : "")}
                </p>
              </div>
              <form
                className="ask-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
              >
                <label htmlFor="question">{c.ask}</label>
                <input
                  id="question"
                  placeholder={c.question}
                  value={question}
                  maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button
                  className="button secondary"
                  disabled={!question.trim() || asking || busy || blocked}
                >
                  {asking ? c.asking : c.askSend}
                </button>
                <p role="status">{answer}</p>
              </form>
            </>
          )}
        </section>
      </div>
      <p role="status">{storageError}</p>
      {debug && (
        <EvalPanel
          key={evalRecord?.id ?? "initial"}
          record={evalRecord}
          frames={frames}
          step={skill.steps.find((s) => s.id === evalRecord?.stepId) ?? step}
          state={context.state}
          prechecks={prechecks}
          model={model}
          setModel={setModel}
          saveFrames={saveFrames}
          setSaveFrames={setSaveFrames}
        />
      )}
    </main>
  );
}
