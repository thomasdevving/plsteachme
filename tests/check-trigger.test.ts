import { describe, expect, it } from 'vitest';
import { CHECK_TIMING, changedShare, createCheckTrigger, toSnapshot, type Snapshot } from '../lib/vision/check-trigger';

const W = 64, H = 48;
/** A flat grey picture with an optional bright block (the learner's hands or work). */
function scene(block: { x: number; size: number } | null = null, noise = 0, seed = 1): Snapshot {
  const data = new Uint8Array(W * H).fill(100);
  let state = seed;
  for (let i = 0; i < data.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    data[i] = 100 + Math.round(((state / 0x7fffffff) - 0.5) * 2 * noise);
  }
  if (block) for (let y = 10; y < 10 + block.size; y++) for (let x = block.x; x < block.x + block.size; x++) data[y * W + x] = 220;
  return { width: W, height: H, data };
}

/** Feeds one snapshot per sample interval and returns the times at which a check fired. */
function run(frames: (t: number) => Snapshot, until: number, confirmingFrom = Infinity) {
  const trigger = createCheckTrigger(), fired: { t: number; reason: string }[] = [];
  let confirmed = false;
  for (let t = 0; t <= until; t += CHECK_TIMING.sampleMs) {
    const confirming = t >= confirmingFrom && !confirmed;
    const snapshot = frames(t), reason = trigger.push(t, snapshot, confirming);
    if (reason) { fired.push({ t, reason }); trigger.checked(t, snapshot); if (confirming) confirmed = true; }
  }
  return fired;
}

describe('camera check trigger', () => {
  it('converts canvas pixels to greyscale and measures the share of changed pixels', () => {
    const snapshot = toSnapshot([255, 255, 255, 255, 0, 0, 0, 255], 2, 1);
    expect([...snapshot.data]).toEqual([255, 0]);
    expect(changedShare(scene(), scene())).toBe(0);
    expect(changedShare(scene(), scene({ x: 10, size: 8 }))).toBeCloseTo(64 / (W * H), 5);
    expect(changedShare(scene(), { width: 32, height: 24, data: new Uint8Array(768) })).toBe(1);
  });

  it('ignores sensor noise and checks once the picture has been at rest', () => {
    const fired = run((t) => scene(null, 8, t), 5000);
    expect(fired[0]).toEqual({ t: CHECK_TIMING.settleMs, reason: 'settled' });
    expect(fired).toHaveLength(1);
  });

  it('waits while the learner works, then checks as soon as the new result comes to rest', () => {
    // At rest until 1 s, hands moving from 1 s to 6 s, a new result held still from 6 s.
    const frames = (t: number) => scene(t < 1000 ? null : { x: t < 6000 ? 4 + Math.floor((t - 1000) / 200) % 40 : 30, size: 10 });
    const fired = run(frames, 9000);
    expect(fired.map((item) => item.reason)).toEqual(['settled', 'settled']);
    expect(fired[1].t).toBeGreaterThanOrEqual(6000 + CHECK_TIMING.settleMs);
    expect(fired[1].t).toBeLessThanOrEqual(6000 + CHECK_TIMING.settleMs + 2 * CHECK_TIMING.sampleMs);
  });

  it('does not check the same unchanged picture again until the idle fallback', () => {
    const fired = run(() => scene({ x: 20, size: 10 }), CHECK_TIMING.idleWaitMs + 3000);
    expect(fired.map((item) => item.reason)).toEqual(['settled', 'timeout']);
    expect(fired[1].t - fired[0].t).toBe(CHECK_TIMING.idleWaitMs);
  });

  it('still checks a picture that never stops moving, no slower than a fixed clock', () => {
    const fired = run((t) => scene({ x: 4 + (t / 200) % 40, size: 10 }), 17000);
    expect(fired.map((item) => item.reason)).toEqual(['timeout', 'timeout']);
    expect(fired[0].t).toBe(CHECK_TIMING.movingWaitMs);
  });

  it('takes a confirming second look at an unchanged picture soon after a positive result', () => {
    const fired = run(() => scene({ x: 20, size: 10 }), 6000, CHECK_TIMING.settleMs + 1);
    expect(fired.map((item) => item.reason)).toEqual(['settled', 'confirm']);
    expect(fired[1].t - fired[0].t).toBe(CHECK_TIMING.confirmGapMs);
  });

  it('keeps small changes apart from new attempts', () => {
    const trigger = createCheckTrigger();
    let t = 0;
    const feed = (snapshot: Snapshot, ms: number) => { let reason = null; for (const end = t + ms; t < end; t += 200) reason ??= trigger.push(t, snapshot); return reason; };
    expect(feed(scene({ x: 20, size: 10 }), 1200)).toBe('settled');
    trigger.checked(t, scene({ x: 20, size: 10 }));
    // One pixel column shifts: below the change threshold, so no new check before the idle fallback.
    expect(feed(scene({ x: 21, size: 10 }), 4000)).toBeNull();
    expect(feed(scene({ x: 40, size: 10 }), 1200)).toBe('settled');
  });
});
