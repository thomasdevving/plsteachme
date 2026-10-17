import type { CameraSetup } from "../skills/schema";
import type { LandmarkFrame } from "./prechecks";
export type ROI = { x: number; y: number; width: number; height: number };
export function getROI(
  f: LandmarkFrame,
  framing: CameraSetup["framing"] = "upper-body",
): ROI {
  // Keep objects intact when there is no reliable anatomical crop.
  if (framing === "tabletop" || framing === "feet")
    return { x: 0, y: 0, width: 1, height: 1 };
  if (framing === "face") {
    const nose = f.pose[0];
    if (!nose) return { x: 0, y: 0, width: 1, height: 1 };
    const span = Math.max(
      0.18,
      Math.abs((f.pose[7]?.x ?? nose.x - 0.1) - (f.pose[8]?.x ?? nose.x + 0.1)),
    );
    const x = Math.max(0, nose.x - span),
      y = Math.max(0, nose.y - span * 1.3);
    return {
      x,
      y,
      width: Math.min(1, nose.x + span) - x,
      height: Math.min(1, nose.y + span * 1.4) - y,
    };
  }
  const [a, b, n] = [f.pose[11], f.pose[12], f.pose[0]];
  if (!a || !b || !n) return { x: 0, y: 0, width: 1, height: 1 };
  const span = Math.max(0.2, Math.abs(a.x - b.x));
  const x = Math.max(0, Math.min(a.x, b.x) - span * 0.45);
  const right = Math.min(1, Math.max(a.x, b.x) + span * 0.45);
  const y = Math.max(0, n.y + 0.025);
  return {
    x,
    y,
    width: right - x,
    height:
      Math.min(
        1,
        Math.max(a.y, b.y) + span * (framing === "neck" ? 0.65 : 1.7),
      ) - y,
  };
}
