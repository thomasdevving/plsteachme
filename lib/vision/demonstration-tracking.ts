// Turns hand landmarks from an instructor's live demonstration into key
// moments. A moment is emitted when the hands have been working and then hold
// still: that pause is usually the visible result of a step, which is what a
// learner's checkpoint is later compared against.

export type Point = { x: number; y: number };
export type HandSummary = { count: number; center: Point | null; box: { x: number; y: number; w: number; h: number } | null };
export type TrackingEvent = { kind: "hold"; at: number; activeFor: number; hands: number };
export type TrackingState = "waiting" | "moving" | "holding";
export type SegmenterOptions = {
  /** Smoothed hand speed (frame widths per second) that counts as working. */
  moveSpeed: number;
  /** Smoothed speed below which the hands are holding still. */
  holdSpeed: number;
  /** Seconds the hands must stay still before a moment is captured. */
  holdSeconds: number;
  /** Minimum seconds of work before a hold counts as a step result. */
  minActiveSeconds: number;
  /** Minimum seconds between two captured moments. */
  minGapSeconds: number;
  /** Seconds without hands after which the current step is abandoned. */
  lostSeconds: number;
};
export const DEFAULT_SEGMENTER: SegmenterOptions = {
  moveSpeed: 0.12,
  holdSpeed: 0.05,
  holdSeconds: 0.9,
  minActiveSeconds: 1.2,
  minGapSeconds: 2.5,
  lostSeconds: 1.5,
};

export function summarizeHands(hands: Point[][]): HandSummary {
  const points = hands.flat().filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!hands.length || !points.length) return { count: 0, center: null, box: null };
  let minX = 1, minY = 1, maxX = 0, maxY = 0, sumX = 0, sumY = 0;
  for (const point of points) {
    const x = Math.min(1, Math.max(0, point.x)), y = Math.min(1, Math.max(0, point.y));
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    sumX += x; sumY += y;
  }
  return {
    count: Math.min(2, hands.length),
    center: { x: sumX / points.length, y: sumY / points.length },
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

export function createSegmenter(options: Partial<SegmenterOptions> = {}) {
  const config = { ...DEFAULT_SEGMENTER, ...options };
  let state: TrackingState = "waiting";
  let previous: { t: number; center: Point } | null = null;
  let speed = 0;
  let activeSince: number | null = null;
  let stillSince: number | null = null;
  let lostSince: number | null = null;
  let lastEvent = -Infinity;
  return {
    get state() { return state; },
    get speed() { return speed; },
    /** Feed one sample; `t` is seconds since recording started. */
    push(t: number, hands: HandSummary): TrackingEvent | null {
      if (!hands.center) {
        // Hands leaving the frame break the current step; a hold needs visible hands.
        lostSince ??= t;
        if (t - lostSince >= config.lostSeconds) { state = "waiting"; activeSince = null; stillSince = null; previous = null; speed = 0; }
        return null;
      }
      lostSince = null;
      if (previous && t > previous.t) {
        const dt = t - previous.t;
        const distance = Math.hypot(hands.center.x - previous.center.x, hands.center.y - previous.center.y);
        // Short gaps keep a steady estimate; long gaps restart it.
        speed = dt > 1 ? 0 : 0.6 * speed + 0.4 * (distance / dt);
      }
      previous = { t, center: hands.center };
      if (speed >= config.moveSpeed) {
        if (state !== "moving") activeSince = t;
        state = "moving";
        stillSince = null;
        return null;
      }
      if (state !== "moving" || speed > config.holdSpeed) { stillSince = null; return null; }
      stillSince ??= t;
      const activeFor = stillSince - (activeSince ?? stillSince);
      if (t - stillSince < config.holdSeconds) return null;
      // A brief fidget followed by stillness is not a step.
      if (activeFor < config.minActiveSeconds) { state = "waiting"; activeSince = null; stillSince = null; return null; }
      if (t - lastEvent < config.minGapSeconds) return null;
      state = "holding";
      lastEvent = t;
      activeSince = null;
      stillSince = null;
      return { kind: "hold", at: t, activeFor, hands: hands.count };
    },
  };
}
