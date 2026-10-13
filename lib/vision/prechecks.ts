import { SESSION_CONFIG } from "../session/config";
export type Point = { x: number; y: number; z?: number; visibility?: number };
export type LandmarkFrame = {
  time: number;
  pose: Point[];
  hands: Point[][];
  luminance: number;
  ambiguous: boolean;
};
export type HandSample = { time: number; hands: Point[][] };
const visible = (p?: Point) =>
  !!p &&
  (p.visibility ?? 1) >= SESSION_CONFIG.landmarkVisibility &&
  p.x > 0.02 &&
  p.x < 0.98 &&
  p.y > 0.02 &&
  p.y < 0.98;
export const bothShouldersVisible = (f: LandmarkFrame) =>
  visible(f.pose[11]) && visible(f.pose[12]);
export const neckRegionVisible = (f: LandmarkFrame) =>
  bothShouldersVisible(f) && visible(f.pose[0]);
export const bothHandsVisible = (f: LandmarkFrame) =>
  f.hands.length >= 2 &&
  f.hands.slice(0, 2).every((h) => h.length >= 21 && h.every(visible));
export const handsInChestRegion = (f: LandmarkFrame) =>
  bothHandsVisible(f) &&
  bothShouldersVisible(f) &&
  f.hands.every(
    (h) =>
      h[0].y > f.pose[0].y &&
      h[0].y < Math.min(1, Math.max(f.pose[11].y, f.pose[12].y) + 0.45),
  );
export const enoughLight = (mean: number, minimum = 70) => mean >= minimum;
export function checks(f: LandmarkFrame, minimum = 70) {
  return {
    bothShouldersVisible: bothShouldersVisible(f),
    neckRegionVisible: neckRegionVisible(f),
    bothHandsVisible: bothHandsVisible(f),
    handsInChestRegion: handsInChestRegion(f),
    enoughLight: enoughLight(f.luminance, minimum),
  };
}
// Compare each point to the first sample: slow drift must not count as stillness.
export function isStill(
  history: HandSample[],
  windowMs: number = SESSION_CONFIG.stillnessWindowMs,
  threshold: number = SESSION_CONFIG.stillnessThreshold,
): boolean {
  if (history.length < 2) return false;
  const end = history.at(-1)!;
  const startIndex = history.findIndex((s) => s.time >= end.time - windowMs);
  const samples = history.slice(Math.max(0, startIndex - 1));
  if (
    end.time - samples[0].time < windowMs ||
    samples.some(
      (s) => s.hands.length !== 2 || s.hands.some((h) => h.length !== 21),
    )
  )
    return false;
  const anchor = samples[0];
  return samples.every((s) =>
    s.hands.every((h, i) =>
      h.every(
        (p, j) =>
          Math.hypot(p.x - anchor.hands[i][j].x, p.y - anchor.hands[i][j].y) <
          threshold,
      ),
    ),
  );
}
export function movement(a: HandSample, b: HandSample) {
  if (a.hands.length !== 2 || b.hands.length !== 2) return 0;
  return Math.max(
    ...a.hands.flatMap((h, i) =>
      h.map((p, j) =>
        b.hands[i]?.[j]
          ? Math.hypot(p.x - b.hands[i][j].x, p.y - b.hands[i][j].y)
          : 0,
      ),
    ),
  );
}
export function selectPose(poses: Point[][]): {
  pose: Point[];
  ambiguous: boolean;
} {
  const candidates = poses
    .filter((p) => visible(p[11]) && visible(p[12]))
    .map((p) => ({
      pose: p,
      distance: Math.abs((p[11].x + p[12].x) / 2 - 0.5),
    }))
    .sort((a, b) => a.distance - b.distance);
  return {
    pose: candidates[0]?.pose ?? poses[0] ?? [],
    ambiguous:
      candidates.length > 1 &&
      candidates[1].distance - candidates[0].distance < 0.2,
  };
}
