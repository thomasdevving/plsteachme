"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, ArrowLeft } from "lucide-react";
import { skillIds, type Locale } from "@/lib/config";
import { categories, modules, type Category } from "@/lib/modules";
import type { Copy } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { SkillIcon } from "./illustrations";
import Link from "next/link";
import { builtinLessonHref } from "@/lib/lesson-navigation";
export function Skills({
  c,
  locale,
}: {
  c: Pick<Copy, "skills" | "form" | "demo">;
  locale: Locale;
}) {
  const [category, setCategory] = useState<Category>("All skills");
  const rail = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    previous: false,
    next: false,
    first: 1,
    last: 3,
  });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    element.scrollLeft = 0;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const inView = Array.from(element.children)
        .map((child, index) => ({ index, rect: child.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.left < bounds.right - 30 && rect.right > bounds.left + 30,
        );
      setPosition({
        // Allow for the rail’s 4px focus inset and subpixel snapping.
        previous: element.scrollLeft > 6,
        next:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 6,
        first: (inView[0]?.index ?? 0) + 1,
        last: (inView.at(-1)?.index ?? 0) + 1,
      });
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [category]);
  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    const card = element.firstElementChild;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 20;
    const distance = card
      ? card.getBoundingClientRect().width + gap
      : element.clientWidth;
    element.scrollBy({
      left: direction * distance,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const visible = skillIds.filter(
    (skill) =>
      category === "All skills" || modules[skill].category === category,
  );
  return (
    <>
      <div className="module-toolbar">
        <div
          className="module-filters"
          role="group"
          aria-label="Filter learning modules"
        >
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
              }}
            >
              {item}
              <span>
                {item === "All skills"
                  ? skillIds.length
                  : skillIds.filter((id) => modules[id].category === item)
                      .length}
              </span>
            </button>
          ))}
        </div>
        <div className="module-navigation">
          <p className="module-count" aria-live="polite">
            {position.first}–{Math.min(position.last, visible.length)} of{" "}
            {visible.length}
          </p>
          <div className="module-arrows">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!position.previous}
              aria-label="Previous learning modules"
              aria-controls="learning-modules"
            >
              <ArrowLeft size={21} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={!position.next}
              aria-label="Next learning modules"
              aria-controls="learning-modules"
            >
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div
        className="skill-grid module-rail"
        id="learning-modules"
        ref={rail}
        key={category}
        role="region"
        aria-label="Learning modules"
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
          ) {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        {visible.map((skill, index) => (
          <article
            style={{ "--module-index": index % 3 } as React.CSSProperties}
            className={`skill-card ${skill === "tie" ? "featured" : ""}`}
            key={skill}
          >
            <div className="skill-art">
              <SkillIcon skill={skill} />
              <span className="module-category">{modules[skill].category}</span>
            </div>
            <div className="skill-info">
              <h3>{c.skills.names[skill]}</h3>
              <p>{c.skills.descriptions[skill]}</p>
              <Link
                className="module-explore text-link"
                aria-label={`Explore lesson: ${c.skills.names[skill]}`}
                href={builtinLessonHref(skill)}
              >
                Explore lesson
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a
                href={builtinLessonHref(skill)}
                className="text-link module-demo"
                onClick={() => track("cta_demo_click")}
              >
                Start lesson
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>

    </>
  );
}
