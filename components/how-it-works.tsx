"use client";
import { useState } from "react";
import {
  ArrowRight,
  RotateCcw,
  Check,
  Camera,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { AvailableSkill } from "@/lib/skills/schema";
import { AnimatedDiagram } from "./animated-diagram";
import { copy } from "@/lib/copy/en";

export function HowItWorks({
  skill,
  graphics,
}: {
  skill: AvailableSkill;
  graphics: Record<string, string>;
}) {
  const [active, setActive] = useState(0);
  const stages = copy.how.stages;
  const stepIndexes = [
    0,
    Math.min(1, skill.steps.length - 1),
    skill.steps.length - 1,
  ];
  const step = skill.steps[stepIndexes[active]];
  return (
    <>
      <section className="how-section page-width" aria-labelledby="how-title">
        <div className="how-heading">
          <h2 id="how-title">{copy.how.title}</h2>
          <p>{copy.how.intro}</p>
        </div>
        <div className="how-layout">
          <ol className="how-stages">
            {stages.map((stage, index) => (
              <li key={stage.title}>
                <button
                  type="button"
                  className={`how-stage ${active === index ? "active" : ""}`}
                  aria-pressed={active === index}
                  onClick={() => setActive(index)}
                >
                  <span className="how-number">{index + 1}</span>
                  <span>
                    <strong>{stage.title}</strong>
                    <span>{stage.body}</span>
                  </span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <div className="how-visual">
            <div className="how-visual-top">
              <span>{copy.how.example}</span>
              <span className="badge">{copy.session.mode}</span>
            </div>
            <AnimatedDiagram
              key={active}
              markup={graphics[step.id]}
              src={step.demoAsset}
              label={step.title}
            />
            <div className="how-visual-caption" key={`caption-${active}`}>
              <span className="how-action-icon" aria-hidden="true">
                {active === 2 ? (
                  <RotateCcw size={22} />
                ) : active === 1 ? (
                  <Check size={22} />
                ) : (
                  <ArrowRight size={22} />
                )}
              </span>
              <div>
                <strong>{stages[active].caption}</strong>
                <p>{stages[active].detail}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="kindness-section">
        <div className="kindness-inner page-width">
          <h2>{copy.how.patientTitle}</h2>
          <div>
            <p>{copy.how.patientBody}</p>
            <p>{copy.how.patientSecond}</p>
            <Link href={`/coach/skills/${skill.id}`} className="quiet-link">
              {copy.how.try}
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section
        className="future-section page-width"
        aria-labelledby="future-title"
      >
        <div className="future-title">
          <h2 id="future-title">{copy.how.futureTitle}</h2>
          <span className="badge">{copy.home.soon}</span>
        </div>
        <p className="future-intro">{copy.how.futureIntro}</p>
        <div className="future-columns">
          <div>
            <Camera size={26} strokeWidth={1.5} aria-hidden="true" />
            <h3>{copy.how.cameraTitle}</h3>
            <p>{copy.how.cameraBody}</p>
          </div>
          <div>
            <ShieldCheck size={26} strokeWidth={1.5} aria-hidden="true" />
            <h3>{copy.how.privacyTitle}</h3>
            <p>{copy.how.privacyBody}</p>
          </div>
        </div>
      </section>
      <section className="closing-section page-width">
        <h2>{copy.how.closingTitle}</h2>
        <p>{copy.how.closingBody}</p>
        <Link href={`/coach/skills/${skill.id}`} className="button primary">
          {copy.how.try}
          <ArrowRight size={21} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
