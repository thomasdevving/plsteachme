"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailableSkill } from "@/lib/skills/schema";
import { AnimatedDiagram } from "./animated-diagram";
import { copy } from "@/lib/copy/en";
import { useMotionPaused } from "@/lib/motion-preference";

const STEP_DURATION_MS = 3600;
export function SkillPreview({
  skill,
  graphics,
  selection,
  onSelect,
}: {
  skill: AvailableSkill;
  graphics: Record<string, string>;
  selection: { index: number; previous: number | null; paused: boolean };
  onSelect: (index: number, pause?: boolean) => void;
}) {
  const { index, previous, paused } = selection;
  const motionPaused = useMotionPaused();
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (surface.current) observer.observe(surface.current);
    const visibility = () => {
      if (document.hidden) setVisible(false);
      else if (surface.current) {
        const rect = surface.current.getBoundingClientRect();
        setVisible(rect.bottom > 0 && rect.top < window.innerHeight);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const playing = !paused && visible && !reducedMotion && !motionPaused;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      onSelect((index + 1) % skill.steps.length, false);
    }, STEP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, skill.steps.length, onSelect]);
  function navigate(direction: number) {
    onSelect((index + direction + skill.steps.length) % skill.steps.length);
  }
  const step = skill.steps[index];
  return (
    <div
      id="lesson-preview"
      ref={surface}
      className={`skill-preview ${reducedMotion ? "is-static" : playing ? "is-playing" : "is-paused"}`}
    >
      <div className="preview-topline">
        <span className="preview-live-dot" aria-hidden="true" />
        <span>{copy.motion.preview}</span>
        <span className="preview-counter">
          {String(index + 1).padStart(2, "0")}
          <span> / {String(skill.steps.length).padStart(2, "0")}</span>
        </span>
      </div>
      <div className="preview-stage">
        <svg
          className="preview-gesture"
          viewBox="0 0 420 340"
          aria-hidden="true"
        >
          <path
            d="M94 254 C49 181 91 101 164 103 C244 105 307 154 275 209 C246 261 160 226 182 160"
            pathLength="1"
          />
          <circle r="4" />
        </svg>
        {previous !== null && !reducedMotion && !motionPaused && (
          <AnimatedDiagram
            key={`previous-${previous}`}
            className="preview-diagram outgoing"
            markup={graphics[skill.steps[previous].id]}
            src={skill.steps[previous].demoAsset}
            label={skill.steps[previous].title}
          />
        )}
        <AnimatedDiagram
          key={step.id}
          className="preview-diagram incoming"
          markup={graphics[step.id]}
          src={step.demoAsset}
          label={`${step.title}. ${copy.session.diagramNote}`}
        />
      </div>
      <div className="preview-caption">
        <span className="preview-step-title" key={step.id}>
          {step.title}
        </span>
        <div className="preview-controls">
          <button
            type="button"
            className="preview-control"
            aria-label={copy.motion.previous}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="preview-control"
            aria-label={copy.motion.next}
            onClick={() => navigate(1)}
          >
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="preview-track" key={`track-${index}`} aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
