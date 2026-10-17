import type { CameraSetup } from "@/lib/skills/schema";
import { framingCopy } from "@/lib/vision/framing";
import { visible, type LandmarkFrame } from "@/lib/vision/prechecks";
const handOutline =
  "M16 66 7 49Q1 39 6 37Q10 35 17 46L16 17Q16 10 21 10Q25 10 25 17L26 33 27 8Q27 2 32 3Q36 3 36 9L36 33 39 13Q40 7 44 9Q48 10 47 16L45 36 48 24Q50 19 54 21Q57 22 55 29L50 53Q48 62 42 67L41 76 19 76Z";
export function CameraGuide({
  camera,
  frame,
}: {
  camera: CameraSetup;
  frame: LandmarkFrame | null;
}) {
  const hands = camera.requiredLandmarks.filter((name) =>
    name.endsWith("Hand"),
  ).length;
  const ready =
    frame?.hands.filter((hand) => hand.length === 21 && hand.every(visible))
      .length ?? 0;
  return (
    <>
      <svg
        className="silhouette"
        viewBox="0 0 300 400"
        role="img"
        aria-label={`${framingCopy[camera.framing].title} positioning guide${hands ? " with hand outlines" : ""}`}
      >
        <g className="guide-body">
          {camera.framing === "upper-body" && (
            <>
              <ellipse cx="150" cy="75" rx="34" ry="44" />
              <path d="M123 113v25l-65 23-15 190M177 113v25l65 23 15 190M123 138l27 25 27-25M150 163l-10 22 10 130 10-130Z" />
            </>
          )}
          {camera.framing === "neck" && (
            <>
              <path d="M150 30v30l10 6h-10" />
              <path d="M100 36q-3 42 50 62 53-20 50-62M112 84v43l-80 42M188 84v43l80 42M112 127l38 38 38-38M150 165l-20 27 20 117 20-117Z" />
              <rect x="82" y="110" width="136" height="218" rx="18" />
            </>
          )}
          {camera.framing === "face" && (
            <>
              <ellipse cx="150" cy="190" rx="85" ry="126" />
              <path d="M115 170h12m46 0h12M150 180v40m-27 37q27 17 54 0" />
            </>
          )}
          {camera.framing === "tabletop" && (
            <>
              <rect x="24" y="90" width="252" height="260" rx="16" />
              <rect x="96" y="145" width="108" height="125" rx="8" />
            </>
          )}
          {camera.framing === "feet" && (
            <>
              <path d="M70 115q-25 5-25 44v116q0 40 40 40t40-40V160q0-50-55-45ZM205 115q-30 5-30 44v116q0 40 40 40t40-40V160q0-50-50-45Z" />
              <path d="m65 180 40 20-40 20 40 20m-40-40 40-20m80 0 40 20-40 20 40 20m-40-40 40-20" />
            </>
          )}
        </g>
        {hands > 0 && (
          <g className="guide-hand" data-ready={ready >= hands}>
            <path d={handOutline} transform="translate(39 216) scale(.9)" />
            {hands === 2 && (
              <path
                d={handOutline}
                transform="translate(261 216) scale(-.9 .9)"
              />
            )}
          </g>
        )}
      </svg>
    </>
  );
}
