"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ListChecks,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import { BrandMark } from "./brand";
import { AccountNavLink } from "./account-nav-link";

type View = "practice" | "coach" | "prepare" | "record";
type WorkspaceProps = {
  title: string;
  subtitle: string;
  step: number;
  steps: number;
  completed: boolean;
  skill?: string;
  className?: string;
  backHref?: string;
  backLabel?: string;
  artwork: ReactNode;
  instruction: ReactNode;
  preparation: ReactNode;
  record?: ReactNode;
  controls: ReactNode;
  note?: ReactNode;
  coaching?: (visible: boolean) => ReactNode;
};

/** A dedicated lesson screen: navigation stays visible while optional tools have their own view. */
export function LessonWorkspace({
  title,
  subtitle,
  step,
  steps,
  completed,
  skill,
  className = "",
  backHref = "/learn",
  backLabel = "All lessons",
  artwork,
  instruction,
  preparation,
  record,
  controls,
  note,
  coaching,
}: WorkspaceProps) {
  const [view, setView] = useState<View>("practice");
  const id = useId();
  useEffect(() => {
    if (completed) setView("practice");
  }, [completed]);
  const views = [
    { id: "practice" as const, label: "Step", icon: BookOpen },
    ...(coaching
      ? [{ id: "coach" as const, label: "Coach", icon: Camera }]
      : []),
    { id: "prepare" as const, label: "Prepare", icon: ShieldCheck },
    ...(record
      ? [{ id: "record" as const, label: "Progress", icon: ListChecks }]
      : []),
  ];
  return (
    <article className={`lesson-screen ${className}`} data-skill={skill}>
      <a href="#lesson-main" className="skip-link">
        Skip to lesson
      </a>
      <header className="lesson-screen-header">
        <Link href={backHref} className="lesson-exit">
          <ArrowLeft size={18} aria-hidden="true" />
          {backLabel}
        </Link>
        <Link
          href="/learn"
          className="wordmark"
          aria-label="plsteach.me learning home"
        >
          <BrandMark />
        </Link>
        <AccountNavLink learning className="lesson-account-link" />
      </header>
      <div className="lesson-screen-heading">
        <div>
          <p>{subtitle}</p>
          <h1>{title}</h1>
        </div>
        <span className="lesson-screen-count">
          {completed ? "Complete" : `${step + 1} / ${steps}`}
        </span>
        <div
          className="lesson-progress"
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={steps}
          aria-valuenow={completed ? steps : step}
          aria-valuetext={
            completed ? "Walkthrough complete" : `Step ${step + 1} of ${steps}`
          }
        >
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={
                completed || i < step ? "complete" : i === step ? "current" : ""
              }
            />
          ))}
        </div>
      </div>
      <nav className="lesson-view-switcher" aria-label="Lesson views">
        {views.map(({ id: panel, label, icon: Icon }) => (
          <button
            key={panel}
            type="button"
            aria-pressed={view === panel}
            aria-controls={`${id}-${panel}`}
            onClick={() => setView(panel)}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      <main id="lesson-main" className="lesson-screen-main" tabIndex={-1}>
        <div
          id={`${id}-practice`}
          hidden={view !== "practice"}
          className="lesson-practice-view"
        >
          <div className="lesson-visual">{artwork}</div>
          <div className="lesson-copy" aria-live="polite">
            {instruction}
          </div>
        </div>
        {coaching && (
          <div
            id={`${id}-coach`}
            hidden={view !== "coach"}
            className="lesson-tool-view"
          >
            {coaching(view === "coach" && !completed)}
          </div>
        )}
        <div
          id={`${id}-prepare`}
          hidden={view !== "prepare"}
          className="lesson-tool-view lesson-overview"
          onClick={(event) => {
            if ((event.target as Element).closest("[data-reset-lesson]"))
              setView("practice");
          }}
        >
          {preparation}
        </div>
        {record && (
          <div
            id={`${id}-record`}
            hidden={view !== "record"}
            className="lesson-tool-view completion-checkpoints"
            onClick={(event) => {
              if ((event.target as Element).closest("button"))
                setView("practice");
            }}
          >
            {record}
          </div>
        )}
      </main>
      <footer className="lesson-screen-footer">
        <div className="lesson-controls">{controls}</div>
        {note && <div className="lesson-footer-note">{note}</div>}
      </footer>
    </article>
  );
}

export function LessonLoadState({
  message,
  retry,
  training = false,
}: {
  message: string;
  retry?: () => void;
  training?: boolean;
}) {
  return (
    <main className="lesson-loading-screen">
      <h1>{retry ? "Your lesson could not load" : "Opening your lesson…"}</h1>
      <p role="status">{message}</p>
      <div>
        {retry && (
          <button
            type="button"
            className="button secondary compact"
            onClick={retry}
          >
            Try again
          </button>
        )}
        <Link href={training ? "/training" : "/learn"} className="text-link">
          {training ? "All training" : "All lessons"}
        </Link>
      </div>
    </main>
  );
}

export function LessonCoachTools({
  active,
  camera,
  questions,
}: {
  active: boolean;
  camera: (visible: boolean) => ReactNode;
  questions?: ReactNode;
}) {
  const [tool, setTool] = useState<"camera" | "questions">("camera");
  useEffect(() => {
    if (!active || tool !== "questions") window.speechSynthesis?.cancel();
  }, [active, tool]);
  return (
    <div className="lesson-coach-tools">
      {questions && (
        <div
          className="lesson-coach-switcher"
          role="group"
          aria-label="Coaching tools"
        >
          <button
            type="button"
            aria-pressed={tool === "camera"}
            onClick={() => setTool("camera")}
          >
            <Camera size={16} aria-hidden="true" />
            Camera
          </button>
          <button
            type="button"
            aria-pressed={tool === "questions"}
            onClick={() => setTool("questions")}
          >
            <MessageCircle size={16} aria-hidden="true" />
            Ask a question
          </button>
        </div>
      )}
      <div hidden={tool !== "camera"}>
        {camera(active && tool === "camera")}
      </div>
      {questions && <div hidden={tool !== "questions"}>{questions}</div>}
    </div>
  );
}
