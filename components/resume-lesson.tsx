"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AvailableSkill } from "@/lib/skills/schema";
import { readDraft } from "@/lib/session/draft";
import { copy } from "@/lib/copy/en";
export function ResumeLesson({ skills }: { skills: AvailableSkill[] }) {
  const [draft, setDraft] = useState<{
    skill: AvailableSkill;
    step: number;
  } | null>(null);
  useEffect(() => {
    for (const skill of skills) {
      const context = readDraft(skill);
      if (context) {
        setDraft({ skill, step: context.stepIndex + 1 });
        break;
      }
    }
  }, [skills]);
  if (!draft) return null;
  return (
    <Link className="resume-link" href={`/session/${draft.skill.id}`}>
      <span>
        <strong>{copy.home.continue}</strong>
        <small>
          {draft.skill.title} ·{" "}
          {copy.session.progress(draft.step, draft.skill.steps.length)}
        </small>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}
