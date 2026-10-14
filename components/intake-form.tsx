"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { AvailableSkill, IntakeAnswers } from "@/lib/skills/schema";
import { createSession } from "@/lib/session/machine";
import { saveDraft } from "@/lib/session/draft";
import { copy } from "@/lib/copy/en";
export function IntakeForm({ skill }: { skill: AvailableSkill }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const question = skill.intake[index];
  const questionRef = useRef<HTMLLegendElement>(null);
  useEffect(() => {
    questionRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [index]);
  function next() {
    if (index + 1 < skill.intake.length) setIndex(index + 1);
    else {
      saveDraft(skill, createSession(answers));
      router.push(`/coach/session/${skill.id}`);
    }
  }
  if (!question)
    return (
      <button className="button primary" onClick={next}>
        {copy.intake.start}
        <ArrowRight aria-hidden="true" />
      </button>
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (answers[question.id]) next();
      }}
      className="intake-form"
    >
      <p className="progress-label">
        {copy.intake.progress(index + 1, skill.intake.length)}
      </p>
      <fieldset key={question.id}>
        <legend ref={questionRef} tabIndex={-1}>
          {question.question}
        </legend>
        <div className="answer-list">
          {question.options.map((option) => (
            <label
              key={option}
              className={`answer-option ${answers[question.id] === option ? "selected" : ""}`}
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={answers[question.id] === option}
                onChange={() =>
                  setAnswers({ ...answers, [question.id]: option })
                }
              />
              <span>{option}</span>
              <span className="radio-indicator" aria-hidden="true">
                {answers[question.id] === option && <Check size={16} />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="intake-actions">
        <button
          className="button primary"
          type="submit"
          disabled={!answers[question.id]}
        >
          {index === skill.intake.length - 1
            ? copy.intake.start
            : copy.intake.next}
          <ArrowRight size={21} aria-hidden="true" />
        </button>
        {index > 0 && (
          <button
            className="button secondary"
            type="button"
            onClick={() => setIndex(index - 1)}
          >
            <ArrowLeft size={20} aria-hidden="true" />
            {copy.common.back}
          </button>
        )}
      </div>
      <p className="small-note">
        {answers[question.id] ? copy.intro.modeDetail : copy.intake.choose}
      </p>
    </form>
  );
}
