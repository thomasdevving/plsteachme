"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Clock3 } from "lucide-react";
import { SkillPreview } from "./skill-preview";
import type { AvailableSkill } from "@/lib/skills/schema";
import { copy } from "@/lib/copy/en";

export function HomeHero({
  skill,
  graphics,
}: {
  skill: AvailableSkill;
  graphics: Record<string, string>;
}) {
  const [selection, setSelection] = useState<{
    index: number;
    previous: number | null;
    paused: boolean;
  }>({ index: 0, previous: null, paused: false });
  const select = useCallback((index: number, pause = true) => {
    setSelection((current) => ({
      index,
      previous: current.index === index ? null : current.index,
      paused: pause || current.paused,
    }));
  }, []);
  useEffect(() => {
    if (selection.previous === null) return;
    const timer = window.setTimeout(
      () => setSelection((current) => ({ ...current, previous: null })),
      650,
    );
    return () => window.clearTimeout(timer);
  }, [selection.index, selection.previous]);

  return (
    <div className="home-layout page-width">
      <section className="home-intro">
        <h1>
          How coaching works.
        </h1>
        <p className="lead">Choose a module, follow the illustrated steps, and practice with optional camera feedback. Here’s an example using the tie lesson.</p>
        <div className="preview-navigation">
          <p id="preview-navigation-label">{copy.motion.choose}</p>
          <div
            className="lesson-line"
            role="group"
            aria-labelledby="preview-navigation-label"
          >
            {skill.steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-label={copy.motion.select(index + 1, step.title)}
                aria-pressed={selection.index === index}
                aria-controls="lesson-preview"
                onClick={() => select(index)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <p
            className="preview-selection"
            aria-live={selection.paused ? "polite" : "off"}
          >
            {selection.index + 1} / {skill.steps.length} ·{" "}
            {skill.steps[selection.index].title}
          </p>
        </div>
        <Link href="/coach" className="quiet-link browse-modules">
          Back to modules
          <ArrowDown size={18} aria-hidden="true" />
        </Link>
      </section>
      <section className="skill-picker" aria-labelledby="skills-title">
        <h2 id="skills-title">Explore a lesson</h2>
        <article className="skill-card">
          <SkillPreview
            skill={skill}
            graphics={graphics}
            selection={selection}
            onSelect={select}
            onTogglePlay={() =>
              setSelection((current) => ({
                ...current,
                paused: !current.paused,
              }))
            }
          />
          <div className="skill-card-content">
            <div className="metadata">
              <span>
                <Clock3 size={16} aria-hidden="true" />
                {skill.estimatedMinutes} {copy.common.minutes}
              </span>
              <span>
                {skill.difficulty === "beginner"
                  ? copy.common.beginner
                  : skill.difficulty}
              </span>
            </div>
            <h3>{skill.title}</h3>
            <p>{skill.description}</p>
            <Link href={`/coach/skills/${skill.id}`} className="button primary">
              {copy.home.start}
              <ArrowRight size={21} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
