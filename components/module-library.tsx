"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import type { Skill } from "@/lib/skills/schema";
import { copy } from "@/lib/copy/en";

export function ModuleLibrary({ skills }: { skills: Skill[] }) {
  const [filter, setFilter] = useState<"all" | Skill["status"]>("all");
  const filtered = skills.filter(
    (skill) => filter === "all" || skill.status === filter,
  );
  return (
    <section
      id="modules"
      className="module-library page-width"
      aria-labelledby="modules-title"
    >
      <div className="module-heading">
        <h2 id="modules-title">{copy.modules.title}</h2>
        <p>{copy.modules.intro}</p>
      </div>
      <div
        className="module-filters"
        role="group"
        aria-label={copy.modules.filters}
      >
        {(
          [
            ["all", copy.modules.all],
            ["available", copy.modules.ready],
            ["coming_soon", copy.modules.soon],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
            <span aria-hidden="true">
              {value === "all"
                ? skills.length
                : skills.filter((skill) => skill.status === value).length}
            </span>
          </button>
        ))}
      </div>
      <ul className="module-grid" aria-live="polite">
        {filtered.map((skill) => (
          <li
            key={skill.id}
            className={
              skill.status === "coming_soon"
                ? "module-item coming-soon"
                : "module-item"
            }
          >
            <Link href={`/skills/${skill.id}`} className="module-link">
              <div className="module-art" aria-hidden="true">
                {skill.catalog ? (
                  <img
                    src={skill.catalog.previewAsset}
                    alt=""
                    width="320"
                    height="200"
                    loading="lazy"
                  />
                ) : (
                  <BookOpen size={60} strokeWidth={1.2} />
                )}
              </div>
              <div className="module-copy">
                <span
                  className={`badge ${skill.status === "available" ? "badge-ready" : ""}`}
                >
                  {skill.status === "available"
                    ? copy.modules.ready
                    : copy.modules.soon}
                </span>
                <h3>{skill.title}</h3>
                <p>{skill.description}</p>
                <span className="module-action">
                  {copy.modules.view}
                  <ArrowUpRight size={20} aria-hidden="true" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
