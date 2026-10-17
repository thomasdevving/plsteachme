"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, BriefcaseBusiness, House, Wrench } from "lucide-react";
import { learningJourneys } from "@/lib/learning-catalog";
import { modules } from "@/lib/modules";
import type { SkillId } from "@/lib/config";

const moments = [
  {
    id: "first-interview",
    label: "Interview day",
    note: "A good place to begin.",
    icon: BriefcaseBusiness,
    annotation: "For your next big little moment.",
  },
  {
    id: "living-independently",
    label: "Everyday independence",
    note: "A little more “I can.”",
    icon: House,
    annotation: "Make yourself a little more at home.",
  },
  {
    id: "care-and-repair",
    label: "A little repair",
    note: "Keep a good thing going.",
    icon: Wrench,
    annotation: "A small fix is a lovely place to start.",
  },
] as const;
type MomentId = (typeof moments)[number]["id"];
const skillTitles: Partial<Record<SkillId, string>> = {
  ironing: "Iron a shirt",
  tie: "Tie a tie",
  button: "Sew on a button",
  laundry: "Do your laundry",
  cooking: "Cook a simple meal",
  drill: "Use a drill",
  bike: "Care for your bike",
};

/** A useful server-rendered first journey, with optional keyboard-friendly exploration. */
export function MomentFinder() {
  const [selected, setSelected] = useState(0);
  const [changed, setChanged] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const moment = moments[selected];
  const journey = learningJourneys.find((item) => item.id === moment.id)!;
  function select(index: number, focus = false) {
    setSelected(index);
    setChanged(true);
    if (focus) tabs.current[index]?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % moments.length
        : event.key === "ArrowLeft"
          ? (index - 1 + moments.length) % moments.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? moments.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      select(next, true);
    }
  }
  return (
    <section className="moment-finder" aria-labelledby={`${id}-title`}>
      <div className="mf-inner">
        <div className="mf-heading" data-reveal>
          <div>
            <p className="mf-eyebrow">
              <span aria-hidden="true" />
              03 / Little skills. Real life.
            </p>
            <h2 id={`${id}-title`}>
              Choose your <em>moment.</em>
            </h2>
          </div>
          <p className="mf-intro">
            A big day. A new routine. That thing you keep putting off. Find a
            small step that fits your life.
          </p>
        </div>

        <div
          className="mf-tabs"
          role="tablist"
          aria-label="Choose a life moment"
        >
          {moments.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                id={`${id}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={selected === index}
                aria-controls={`${id}-panel`}
                tabIndex={selected === index ? 0 : -1}
                data-moment={item.id}
                onClick={() => select(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className="mf-tab-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <span className="mf-tab-copy">
                  <strong>{item.label}</strong>
                  <span>{item.note}</span>
                </span>
                <Icon
                  className="mf-tab-icon"
                  size={25}
                  strokeWidth={1.4}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div
          className="mf-panel"
          id={`${id}-panel`}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`${id}-tab-${selected}`}
          data-changed={changed}
        >
          <div className="mf-panel-content" key={moment.id}>
            <figure className={`mf-postcard mf-postcard--${moment.id}`}>
              <span className="mf-tape" aria-hidden="true" />
              <p className="mf-postcard-label" aria-hidden="true">
                Things you can learn to do.
              </p>
              <div className="mf-scene">
                <MomentScene moment={moment.id} />
              </div>
              <figcaption>{moment.annotation}</figcaption>
              <span className="mf-postcard-spark" aria-hidden="true">
                ✳
              </span>
            </figure>

            <div className="mf-plan">
              <p className="mf-plan-eyebrow">
                Your small-step plan{" "}
                <span>{journey.skills.length} lessons</span>
              </p>
              <h3>{journey.title}</h3>
              <p className="mf-plan-description">{journey.description}</p>
              <ol className="mf-lessons">
                {journey.skills.map((skill, index) => (
                  <li key={skill}>
                    <a
                      href={`/learn?skill=${skill}`}
                    >
                      <span className="mf-lesson-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="mf-lesson-copy">
                        <strong>{skillTitles[skill] ?? skill}</strong>
                        <span>
                          {modules[skill].steps.length} guided steps ·{" "}
                          {modules[skill].materials[0]}
                        </span>
                      </span>
                      <ArrowRight
                        size={20}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mf-plan-note">Start with one. The rest can wait.</p>
            </div>
          </div>
        </div>
        <div className="mf-footnote">
          <p>Illustrated lessons. Room to try again.</p>
          <a href="/learn">
            Explore every skill <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <p className="mf-announcement" role="status">
          {changed
            ? `${moment.label}: ${journey.skills.length} lessons to explore.`
            : ""}
        </p>
      </div>
    </section>
  );
}

function MomentScene({ moment }: { moment: MomentId }) {
  return (
    <svg
      viewBox="0 0 420 330"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="212"
        cy="289"
        rx="151"
        ry="13"
        fill="#22372c"
        opacity=".07"
      />
      <circle
        cx="205"
        cy="163"
        r="119"
        fill={moment === "living-independently" ? "#e1e7d8" : "#f0d6c4"}
      />
      {moment === "first-interview" ? (
        <>
          <path
            d="M198 56c0-18 24-20 25-5 1 8-13 12-13 20v7l83 37c4 2 2 8-2 8H128c-5 0-6-6-2-8l84-37"
            stroke="#22372c"
            strokeWidth="3"
          />
          <path
            d="m169 103-51 27-31 70 45 18 17-34-3 101h136l-5-101 16 34 45-18-31-70-51-27-43 18-44-18Z"
            fill="#fffdf6"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <path
            d="m169 103 44 18-30 29-22-38m95-9-43 18 29 29 22-38M213 127v158"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <path
            d="m201 127 12-6 12 6-6 18h-12l-6-18Zm6 18-13 95 19 24 19-24-13-95"
            fill="#bb4827"
            stroke="#bb4827"
            strokeWidth="2.5"
          />
          <path
            d="m204 166 19 17m-22 4 25 22m-28 0 29 26"
            stroke="#f3cbb2"
            strokeWidth="2"
          />
          <path d="M251 170h15v28h-15" stroke="#b8c2ac" strokeWidth="2" />
          <g transform="rotate(-12 88 256)">
            <rect
              x="46"
              y="225"
              width="80"
              height="62"
              rx="5"
              fill="#dce3d2"
              stroke="#22372c"
              strokeWidth="2.5"
            />
            <path
              d="M62 243h40m-40 12h30m-30 12h35"
              stroke="#22372c"
              strokeWidth="2"
            />
          </g>
          <path
            d="m333 91 3-15m-15 8 13 5 14-3m-12 5 6 12"
            stroke="#bb4827"
            strokeWidth="2.5"
          />
        </>
      ) : moment === "living-independently" ? (
        <>
          <rect
            x="66"
            y="67"
            width="180"
            height="217"
            rx="13"
            fill="#fffdf6"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <path
            d="M67 118h178M88 87h49v13H88z"
            stroke="#22372c"
            strokeWidth="2"
          />
          <circle cx="214" cy="93" r="10" fill="#bb4827" />
          <path d="m214 88 3 5" stroke="#fffdf6" strokeWidth="2" />
          <circle
            cx="156"
            cy="193"
            r="56"
            fill="#dbe4cf"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <circle cx="156" cy="193" r="43" fill="#22372c" />
          <path
            d="M118 199c17-34 30 13 50-4 12-11 20-4 28 2-1 19-18 36-40 36-17 0-31-11-38-34Z"
            fill="#f4e6ce"
          />
          <path
            d="M121 186c21 12 35-14 54 1"
            stroke="#8fa385"
            strokeWidth="8"
          />
          <path d="M78 286v8m157-8v8" stroke="#22372c" strokeWidth="5" />
          <path
            d="M253 180c-1-28 13-38 27-35 3 20-7 33-27 35Z"
            fill="#6b8663"
            stroke="#22372c"
            strokeWidth="2"
          />
          <path
            d="M276 189c4-29 19-34 32-27-2 20-12 28-32 27Z"
            fill="#a3b48e"
            stroke="#22372c"
            strokeWidth="2"
          />
          <ellipse
            cx="287"
            cy="228"
            rx="69"
            ry="21"
            fill="#f3dbc5"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <path
            d="M218 228c5 40 26 61 69 61 42 0 63-21 69-61-37 22-105 22-138 0Z"
            fill="#bb4827"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <path
            d="M239 246c6 16 15 23 26 25"
            stroke="#f3cbb2"
            strokeWidth="3"
          />
          <circle cx="271" cy="224" r="7" fill="#bb4827" />
          <circle cx="305" cy="220" r="8" fill="#bb4827" />
          <circle cx="287" cy="231" r="6" fill="#718363" />
          <path
            d="m251 215 6 4m35-8 3 5m28 11-5 4"
            stroke="#718363"
            strokeWidth="4"
          />
          <path
            d="m317 95 5-14m-15 7 12 7 15-1m-14 5 4 12"
            stroke="#bb4827"
            strokeWidth="2.5"
          />
        </>
      ) : (
        <>
          <path
            d="M87 255c-28-28-32-64-10-82 25-20 66-3 75 16 19 44 49 54 78 25 24-24 52-15 58 2 7 19-4 44-24 55"
            stroke="#22372c"
            strokeWidth="3"
          />
          <circle
            cx="178"
            cy="138"
            r="76"
            fill="#bb4827"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <circle cx="178" cy="138" r="61" stroke="#f2bd99" strokeWidth="2" />
          <circle cx="164" cy="124" r="7" fill="#22372c" />
          <circle cx="192" cy="124" r="7" fill="#22372c" />
          <circle cx="164" cy="152" r="7" fill="#22372c" />
          <circle cx="192" cy="152" r="7" fill="#22372c" />
          <path
            d="m164 124 28 28m0-28-28 28"
            stroke="#f8ebd6"
            strokeWidth="5"
          />
          <g transform="rotate(27 298 237)">
            <path
              d="M298 163c-8 12-8 25-5 37l5 103 5-103c3-12 3-25-5-37Z"
              fill="#fffdf6"
              stroke="#22372c"
              strokeWidth="2.5"
            />
            <path d="M298 178v17" stroke="#22372c" strokeWidth="2.5" />
          </g>
          <path
            d="M92 261h99v27H92z"
            fill="#cbd8bc"
            stroke="#22372c"
            strokeWidth="2.5"
          />
          <path
            d="m103 262 7 13m9-13 7 13m9-13 7 13m9-13 7 13m9-13 7 13"
            stroke="#22372c"
            strokeWidth="1.5"
          />
          <path
            d="m309 86 3-15m-15 8 13 5 14-3m-12 5 6 12"
            stroke="#bb4827"
            strokeWidth="2.5"
          />
        </>
      )}
    </svg>
  );
}
