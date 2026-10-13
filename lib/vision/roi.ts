import type { LandmarkFrame } from "./prechecks";
export type ROI = { x: number; y: number; width: number; height: number };
export function getROI(f: LandmarkFrame): ROI {
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
    height: Math.min(1, Math.max(a.y, b.y) + span * 1.7) - y,
  };
}
