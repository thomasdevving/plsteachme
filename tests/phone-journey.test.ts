import { expect, it } from "vitest";
import {
  phoneJourneyFrame,
  type PhoneJourneyGeometry,
} from "../lib/phone-journey";

const geometry: PhoneJourneyGeometry = {
  from: { x: 800, y: 360 },
  to: { x: 600, y: 1000 },
  startScroll: 0,
  endScroll: 600,
  targetScale: 1.4,
  frameWidth: 280,
  frameHeight: 510,
  maxWidth: 1160,
};

it("lands at the demo center in landscape and clamps beyond both ends", () => {
  expect(phoneJourneyFrame(-100, geometry)).toMatchObject({
    angle: 3,
    mode: "hero",
    x: 800,
    y: 360,
  });
  expect(phoneJourneyFrame(600, geometry)).toMatchObject({
    angle: 90,
    mode: "demo",
    x: 600,
    y: 1000,
    reveal: 1,
  });
  expect(phoneJourneyFrame(900, geometry)).toEqual(
    phoneJourneyFrame(600, geometry),
  );
});

it("moves continuously in both directions without accumulating rotation", () => {
  const positions = [0, 100, 200, 300, 400, 500, 600].map((y) =>
    phoneJourneyFrame(y, geometry),
  );
  positions
    .slice(1)
    .forEach((position, index) =>
      expect(position.angle).toBeGreaterThan(positions[index].angle),
    );
  expect(phoneJourneyFrame(300, geometry)).toEqual(positions[3]);
  expect(positions[3]).toMatchObject({
    angle: 46.5,
    mode: "moving",
    reveal: 0,
  });
});

it("keeps the rotating diagonal within a narrow viewport", () => {
  const mobile = {
    ...geometry,
    frameWidth: 245,
    frameHeight: 460,
    maxWidth: 280,
    targetScale: 280 / 460,
  };
  for (let y = 0; y <= 600; y += 5) {
    const frame = phoneJourneyFrame(y, mobile);
    const angle = (frame.angle * Math.PI) / 180;
    const width =
      (245 * Math.abs(Math.cos(angle)) + 460 * Math.abs(Math.sin(angle))) *
      frame.scale;
    expect(width).toBeLessThanOrEqual(280.00001);
  }
});

it("waits for the mobile hero phone to reach the viewport and respects reduced motion", () => {
  const mobile = { ...geometry, startScroll: 400, endScroll: 1000 };
  expect(phoneJourneyFrame(300, mobile).mode).toBe("hero");
  expect(phoneJourneyFrame(650, mobile, true).angle).toBe(3);
  expect(phoneJourneyFrame(750, mobile, true).angle).toBe(90);
});
