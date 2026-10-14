"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AvailableSkill } from "@/lib/skills/schema";
import { restoreDraft } from "@/lib/session/draft";
import { copy } from "@/lib/copy/en";
export function ResumeLesson({ skills }: { skills: AvailableSkill[] }) {
  const [draft, setDraft] = useState<{
    skill: AvailableSkill;
    step: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      for (const skill of skills) {
        const context = await restoreDraft(skill);
        if (context && active) {
          setDraft({ skill, step: context.stepIndex + 1 });
          break;
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [skills]);
  if (!draft) return null;
  return (
    <Link className="resume-link" href={`/coach/session/${draft.skill.id}`}>
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
