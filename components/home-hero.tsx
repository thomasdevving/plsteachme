"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Clock3 } from "lucide-react";
import { SkillPreview } from "./skill-preview";
import { ResumeLesson } from "./resume-lesson";
import type { AvailableSkill } from "@/lib/skills/schema";
import { copy } from "@/lib/copy/en";

export function HomeHero({
  skill,
  graphics,
  available,
}: {
  skill: AvailableSkill;
  graphics: Record<string, string>;
  available: AvailableSkill[];
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
        <p className="mission">{copy.mission}</p>
        <h1>
          {copy.home.title.split("\n").map((line, index) => (
            <span
              key={line}
              className={index === 1 ? "accent-line" : undefined}
            >
              {line}
            </span>
          ))}
        </h1>
        <p className="lead">{copy.home.intro}</p>
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
        <a href="#modules" className="quiet-link browse-modules">
          {copy.modules.browse}
          <ArrowDown size={18} aria-hidden="true" />
        </a>
        <p className="intro-footnote">{copy.home.footer}</p>
      </section>
      <section className="skill-picker" aria-labelledby="skills-title">
        <h2 id="skills-title">{copy.home.skills}</h2>
        <ResumeLesson skills={available} />
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
            <Link href={`/skills/${skill.id}`} className="button primary">
              {copy.home.start}
              <ArrowRight size={21} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
