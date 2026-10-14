"use client";
import { useLayoutEffect, useRef } from "react";

type Point = readonly [number, number];
type Pose = {
  label: string;
  spine: readonly Point[];
  guide: string;
  band: string;
};
const looseBand = "M184 145Q209 138 239 146L231 173Q210 179 190 169Z";
const hiddenBand = "M207 145Q210 144 213 145L212 147Q210 148 208 147Z";
// Front view: the wearer's right is image-left. The wide blade stays connected
// to its collar-side length; the rear blade and front wrap are separate layers.
const poses: Pose[] = [
  {
    label: "Start with the wide end longer",
    spine: [
      [182, 82],
      [180, 116],
      [175, 156],
      [170, 196],
      [166, 235],
      [164, 276],
    ],
    guide: "M128 182V273m-6-7 6 7 6-7",
    band: hiddenBand,
  },
  {
    label: "Cross the wide end over the narrow end",
    spine: [
      [182, 82],
      [186, 115],
      [211, 142],
      [241, 174],
      [258, 213],
      [265, 262],
    ],
    guide: "M147 177Q206 149 276 191m-10 0 10 0-4-9",
    band: hiddenBand,
  },
  {
    label: "Wrap the wide end behind the narrow end",
    spine: [
      [182, 82],
      [186, 115],
      [215, 139],
      [231, 157],
      [181, 177],
      [153, 252],
    ],
    guide: "M266 187Q207 215 142 193m10-3-10 3 6 8",
    band: hiddenBand,
  },
  {
    label: "Bring the wide end across the front",
    spine: [
      [182, 82],
      [186, 115],
      [215, 139],
      [182, 157],
      [239, 170],
      [266, 251],
    ],
    guide: "M143 198Q208 173 282 199m-10 0 10 0-4-9",
    band: looseBand,
  },
  {
    label: "Lift the wide end through the neck loop",
    spine: [
      [182, 82],
      [186, 115],
      [213, 139],
      [240, 161],
      [215, 113],
      [216, 48],
    ],
    guide: "M270 157Q287 103 265 59m-2 10 2-10 9 4",
    band: looseBand,
  },
  {
    label: "Pass the wide end down through the front loop",
    spine: [
      [182, 82],
      [186, 115],
      [214, 139],
      [217, 169],
      [213, 219],
      [211, 278],
    ],
    guide: "M260 185V268m-6-7 6 7 6-7",
    band: looseBand,
  },
  {
    label: "Slide the knot up gently",
    spine: [
      [182, 82],
      [188, 101],
      [211, 113],
      [212, 155],
      [213, 216],
      [212, 278],
    ],
    guide: "M263 161V113m-6 7 6-7 6 7",
    band: "M190 102Q209 97 231 104L222 131Q210 135 199 127Z",
  },
];

// Sample a smooth fabric centerline, then offset its two edges. A gradually
// widening blade and a pointed tip preserve tie proportions throughout a move.
function ribbon(spine: readonly Point[]) {
  const points: Point[] = [];
  for (let segment = 0; segment < spine.length - 1; segment++) {
    const a = spine[Math.max(0, segment - 1)],
      b = spine[segment];
    const c = spine[segment + 1],
      d = spine[Math.min(spine.length - 1, segment + 2)];
    for (let sample = 0; sample < 10; sample++) {
      const t = sample / 10;
      points.push(
        [0, 1].map(
          (axis) =>
            0.5 *
            (2 * b[axis] +
              (-a[axis] + c[axis]) * t +
              (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t +
              (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t * t * t),
        ) as unknown as Point,
      );
    }
  }
  points.push(spine[spine.length - 1]);
  const left: Point[] = [],
    right: Point[] = [];
  points.forEach((point, i) => {
    const before = points[Math.max(0, i - 1)],
      after = points[Math.min(points.length - 1, i + 1)];
    const dx = after[0] - before[0],
      dy = after[1] - before[1],
      length = Math.hypot(dx, dy) || 1;
    const t = i / (points.length - 1),
      width = 12 + 28 * Math.pow(t, 1.65);
    left.push([
      point[0] - ((dy / length) * width) / 2,
      point[1] + ((dx / length) * width) / 2,
    ]);
    right.push([
      point[0] + ((dy / length) * width) / 2,
      point[1] - ((dx / length) * width) / 2,
    ]);
  });
  const last = points.at(-1)!,
    before = points.at(-2)!;
  const length = Math.hypot(last[0] - before[0], last[1] - before[1]);
  const tip: Point = [
    last[0] + ((last[0] - before[0]) / length) * 23,
    last[1] + ((last[1] - before[1]) / length) * 23,
  ];
  return (
    [...left, tip, ...right.reverse()]
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
      .join("") + "Z"
  );
}
const shapes = poses.map((pose) => ribbon(pose.spine));

export function TieMotion({
  step,
  playing,
}: {
  step: number;
  playing: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null),
    wide = useRef<SVGPathElement>(null),
    band = useRef<SVGPathElement>(null);
  const previous = useRef(step),
    animations = useRef<Animation[]>([]);
  const pose = poses[step];
  useLayoutEffect(() => {
    animations.current = [];
    const from = previous.current;
    previous.current = step;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    // Reset the demonstration directly; never morph a finished knot into a drape.
    if (from === step || step === 0 || preference.matches) return;
    const active: Animation[] = [];
    for (const [element, start, end] of [
      [wide.current, shapes[from], shapes[step]],
      [band.current, poses[from].band, pose.band],
    ] as const) {
      if (element)
        active.push(
          element.animate(
            [{ d: `path('${start}')` }, { d: `path('${end}')` }],
            { duration: 1050, easing: "cubic-bezier(.4,0,.2,1)" },
          ),
        );
    }
    animations.current = active;
    const reduce = () => {
      if (preference.matches) active.forEach((animation) => animation.finish());
    };
    preference.addEventListener("change", reduce);
    return () => {
      active.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", reduce);
    };
  }, [step, pose]);
  useLayoutEffect(() => {
    const node = svg.current;
    if (!node) return;
    let visible = false;
    const sync = () =>
      animations.current.forEach((animation) => {
        if (animation.playState !== "finished")
          playing && visible && !document.hidden
            ? animation.play()
            : animation.pause();
      });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [playing, step]);
  return (
    <svg
      ref={svg}
      className="tie-motion"
      data-step={step + 1}
      viewBox="50 20 320 310"
      role="img"
      aria-label={`Step ${step + 1}: ${pose.label}`}
    >
      <path
        d="M161 47V73L95 102Q76 111 72 137L54 325H367L349 137Q345 111 326 102L258 73V47"
        fill="#f8f7ef"
      />
      <path
        d="M161 47V73L95 102Q76 111 72 137L54 325M258 47V73L326 102Q345 111 349 137L367 325"
        fill="none"
        stroke="#98a18d"
        strokeWidth="1.8"
      />
      <path
        d="M199 137V325M218 137V325"
        fill="none"
        stroke="#d9ddce"
        strokeWidth="1.5"
      />
      <g fill="#b7bfa9">
        <circle cx="208.5" cy="198" r="2.5" />
        <circle cx="208.5" cy="258" r="2.5" />
      </g>
      <path
        d="M180 77Q209 93 239 77"
        fill="none"
        stroke="#943d26"
        strokeWidth="11"
      />
      <path
        className="tie-narrow-end"
        d="M232 80Q240 112 226 147L222 246L211 259L201 247L209 146Q226 112 221 83Z"
        fill="#a86548"
        stroke="#873b27"
        strokeWidth="1"
      />
      <path
        ref={wide}
        className="tie-wide-end"
        d={shapes[step]}
        fill="#bb4827"
        stroke="#963d24"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {step === 2 && (
        <>
          <path
            d="M219 141L229 145L225 185L206 185L211 145Z"
            fill="#a86548"
            stroke="#873b27"
            strokeWidth="1"
          />
          <path
            d="M178 108Q190 126 219 137L214 151Q186 137 175 114Z"
            fill="#bb4827"
            stroke="#963d24"
            strokeWidth="1"
          />
        </>
      )}
      <path
        ref={band}
        className="tie-front-band"
        d={pose.band}
        fill="#bb4827"
        stroke="#873b27"
        strokeWidth="1.3"
        opacity={step >= 3 ? 1 : 0}
      />
      {step >= 3 && (
        <path
          d={
            step === 6
              ? "M198 107Q210 105 224 109M210 134Q207 144 211 154"
              : "M190 150Q210 145 232 151"
          }
          fill="none"
          stroke="#873b27"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      <path
        d="M161 65L145 88L174 129L194 91ZM258 65L276 88L247 129L225 91Z"
        fill="#f8f7ef"
        stroke="#98a18d"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M161 65Q209 88 258 65"
        fill="none"
        stroke="#98a18d"
        strokeWidth="1.8"
      />
      <path
        className="tie-step-guide"
        d={pose.guide}
        fill="none"
        stroke="#7b442f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
