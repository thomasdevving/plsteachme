// When the camera coach should look: once the learner's hands and work come
// to rest after something changed, not on a fixed clock. A tiny greyscale
// copy of the frame is compared on the device; nothing is sent for this.

/** A small greyscale frame: one byte of brightness per pixel. */
export type Snapshot = { width: number; height: number; data: Uint8Array };

export const SNAPSHOT_WIDTH = 64;

export const CHECK_TIMING = {
  /** How often a snapshot is taken. */
  sampleMs: 200,
  /** A pixel counts as changed when its brightness moves by more than this (0–255). */
  pixelDelta: 18,
  /** Share of pixels changed since the picture came to rest that counts as movement. */
  motionShare: 0.012,
  /** How long the picture must stay at rest before a check. */
  settleMs: 800,
  /** Share of changed pixels since the last check that counts as a new attempt. */
  changeShare: 0.03,
  /** Minimum time between two checks of a new attempt. */
  minGapMs: 2500,
  /** Minimum time before a confirming second look at a result. */
  confirmGapMs: 1200,
  /** Look anyway after this long while the picture keeps moving (a handheld phone, continuous work): no slower than a fixed clock. */
  movingWaitMs: 8000,
  /** Look again after this long when the picture is at rest but unchanged: a change too small to see here must not stall coaching. */
  idleWaitMs: 20000,
} as const;
export type CheckTiming = typeof CHECK_TIMING;

/** Converts RGBA pixels (as from a canvas) to a greyscale snapshot. */
export function toSnapshot(rgba: ArrayLike<number>, width: number, height: number): Snapshot {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < data.length; i += 4, p++)
    data[p] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return { width, height, data };
}

/** Share of pixels whose brightness changed noticeably. Different sizes count as a complete change. */
export function changedShare(a: Snapshot, b: Snapshot, delta: number = CHECK_TIMING.pixelDelta) {
  if (a.width !== b.width || a.height !== b.height || !a.data.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.data.length; i++) if (Math.abs(a.data[i] - b.data[i]) > delta) changed++;
  return changed / a.data.length;
}

export type TriggerReason = 'settled' | 'confirm' | 'timeout';

/**
 * Decides, snapshot by snapshot, when to check:
 * - a new attempt: the picture differs from the last checked one and has been at rest for `settleMs`;
 * - a confirmation: after a positive result, a second look once the picture is at rest, changed or not;
 * - a fallback after `movingWaitMs` of constant movement, or `idleWaitMs` of an unchanged picture at rest.
 */
export function createCheckTrigger(timing: CheckTiming = CHECK_TIMING) {
  // Compared with the picture at the start of the rest, not the previous one: slow drift must not count as rest.
  let anchor: Snapshot | null = null;
  let stillSince = 0;
  let since: number | null = null;
  let checked: { time: number; snapshot: Snapshot } | null = null;
  return {
    push(time: number, snapshot: Snapshot, confirming = false): TriggerReason | null {
      since ??= time;
      if (!anchor || changedShare(anchor, snapshot, timing.pixelDelta) > timing.motionShare) {
        anchor = snapshot;
        stillSince = time;
      }
      const settled = time - stillSince >= timing.settleMs;
      const elapsed = time - (checked?.time ?? since);
      if (confirming) return settled && elapsed >= timing.confirmGapMs ? 'confirm' : elapsed >= timing.movingWaitMs ? 'timeout' : null;
      if (!settled) return elapsed >= timing.movingWaitMs ? 'timeout' : null;
      if (checked && elapsed < timing.minGapMs) return null;
      const changed = !checked || changedShare(checked.snapshot, snapshot, timing.pixelDelta) > timing.changeShare;
      return changed ? 'settled' : elapsed >= timing.idleWaitMs ? 'timeout' : null;
    },
    /** Records the picture that was just checked. */
    checked(time: number, snapshot: Snapshot) {
      checked = { time, snapshot };
    },
  };
}
