import { describe, it, expect } from "vitest";
import {
  bothShouldersVisible,
  neckRegionVisible,
  bothHandsVisible,
  handsInChestRegion,
  enoughLight,
  isStill,
  selectPose,
  type LandmarkFrame,
} from "../lib/vision/prechecks";
import { getROI } from "../lib/vision/roi";
const hand = (x: number) => Array.from({ length: 21 }, () => ({ x, y: 0.6 }));
const frame = (): LandmarkFrame => ({
  time: 0,
  pose: Array.from({ length: 33 }, (_, i) => ({
    x: i === 11 ? 0.3 : i === 12 ? 0.7 : 0.5,
    y: i === 0 ? 0.2 : 0.4,
    visibility: 1,
  })),
  hands: [hand(0.3), hand(0.7)],
  luminance: 80,
  ambiguous: false,
});
describe("local visibility gates", () => {
  it("requires visible shoulders, nose and full hands", () => {
    const f = frame();
    expect(
      bothShouldersVisible(f) &&
        neckRegionVisible(f) &&
        bothHandsVisible(f) &&
        handsInChestRegion(f),
    ).toBe(true);
    f.pose[11].visibility = 0.1;
    expect(bothShouldersVisible(f)).toBe(false);
    expect(neckRegionVisible(f)).toBe(false);
    f.hands[0][8].x = 1.1;
    expect(bothHandsVisible(f)).toBe(false);
  });
  it("rejects low light and respects skill threshold", () => {
    expect(enoughLight(69)).toBe(false);
    expect(enoughLight(70)).toBe(true);
    expect(enoughLight(80, 90)).toBe(false);
  });
  it("requires a full still window and does not treat missing hands as stillness", () => {
    expect(
      isStill([
        { time: 0, hands: [] },
        { time: 1500, hands: [] },
      ]),
    ).toBe(false);
    expect(
      isStill([
        { time: 0, hands: frame().hands },
        { time: 1400, hands: frame().hands },
      ]),
    ).toBe(false);
    expect(
      isStill([
        { time: 0, hands: frame().hands },
        { time: 1500, hands: frame().hands },
      ]),
    ).toBe(true);
  });
  it("rejects cumulative drift even with small individual movements", () => {
    const samples = Array.from({ length: 16 }, (_, i) => ({
      time: i * 100,
      hands: [hand(0.3 + i * 0.002), hand(0.7)],
    }));
    expect(isStill(samples)).toBe(false);
  });
  it("flags equally central people, but chooses a distinctly central person", () => {
    const f = frame();
    expect(selectPose([f.pose, f.pose]).ambiguous).toBe(true);
    const other = f.pose.map((p) => ({ ...p, x: p.x + 0.23 }));
    expect(selectPose([other, f.pose]).pose).toEqual(f.pose);
    expect(selectPose([other, f.pose]).ambiguous).toBe(false);
  });
  it("clamps the ROI and includes the lower tie", () => {
    const roi = getROI(frame());
    expect(roi.x).toBeGreaterThanOrEqual(0);
    expect(roi.x + roi.width).toBeLessThanOrEqual(1);
    expect(roi.y + roi.height).toBe(1);
    expect(getROI({ ...frame(), pose: [] })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});

import { cameraSetupSchema } from "../lib/skills/schema";
import { framingChecks, ambiguousSubject } from "../lib/vision/framing";
const camera = (
  framing: "upper-body" | "face" | "tabletop" | "feet" | "neck",
  requiredLandmarks: string[],
) =>
  cameraSetupSchema.parse({
    framing,
    requiredLandmarks,
    instruction: "Position the camera",
    minLuminance: 70,
  });
it("uses configured landmarks: tabletop checks need no head or shoulders", () => {
  const config = camera("tabletop", ["leftHand", "rightHand"]);
  const f = { ...frame(), pose: [], ambiguous: true };
  expect(framingChecks(f, config).map((c) => c.id)).toEqual(["hands", "light"]);
  expect(framingChecks(f, config).every((c) => c.ready)).toBe(true);
  expect(ambiguousSubject(f, config)).toBe(false);
  expect(getROI(f, "tabletop")).toEqual({ x: 0, y: 0, width: 1, height: 1 });
});
it("does not demand hands for a face or finished-knot close-up", () => {
  const f = { ...frame(), hands: [] };
  for (const config of [
    camera("face", ["nose"]),
    camera("neck", ["nose", "leftShoulder", "rightShoulder"]),
  ]) {
    expect(framingChecks(f, config).every((c) => c.ready)).toBe(true);
    expect(framingChecks(f, config).some((c) => c.id === "hands")).toBe(false);
  }
  expect(getROI(f, "neck").height).toBeLessThan(getROI(f).height);
});
it("checks feet when configured and preserves the whole shoe view", () => {
  const f = frame();
  const config = camera("feet", [
    "leftFoot",
    "rightFoot",
    "leftHand",
    "rightHand",
  ]);
  expect(framingChecks(f, config).every((c) => c.ready)).toBe(true);
  f.pose[31].visibility = 0;
  expect(framingChecks(f, config).find((c) => c.id === "leftFoot")?.ready).toBe(
    false,
  );
  expect(getROI(f, "feet")).toEqual({ x: 0, y: 0, width: 1, height: 1 });
});
it("keeps every framing crop inside the source image", () => {
  for (const profile of [
    "upper-body",
    "neck",
    "face",
    "tabletop",
    "feet",
  ] as const) {
    const roi = getROI(frame(), profile);
    expect(roi.x).toBeGreaterThanOrEqual(0);
    expect(roi.y).toBeGreaterThanOrEqual(0);
    expect(roi.width).toBeGreaterThan(0);
    expect(roi.height).toBeGreaterThan(0);
    expect(roi.x + roi.width).toBeLessThanOrEqual(1);
    expect(roi.y + roi.height).toBeLessThanOrEqual(1);
  }
});
