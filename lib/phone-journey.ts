export type PhoneJourneyGeometry = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startScroll: number;
  endScroll: number;
  targetScale: number;
  frameWidth: number;
  frameHeight: number;
  maxWidth: number;
};

export function phoneJourneyFrame(
  scrollY: number,
  geometry: PhoneJourneyGeometry,
  reducedMotion = false,
) {
  const raw = Math.max(
    0,
    Math.min(
      1,
      (scrollY - geometry.startScroll) /
        Math.max(1, geometry.endScroll - geometry.startScroll),
    ),
  );
  const progress = reducedMotion
    ? raw >= 0.5
      ? 1
      : 0
    : raw * raw * (3 - 2 * raw);
  const angle = 3 + 87 * progress;
  const radians = (angle * Math.PI) / 180;
  const rotatedWidth =
    geometry.frameWidth * Math.abs(Math.cos(radians)) +
    geometry.frameHeight * Math.abs(Math.sin(radians));
  const scale = Math.min(
    1 + (geometry.targetScale - 1) * progress,
    geometry.maxWidth / rotatedWidth,
  );
  return {
    progress,
    x: geometry.from.x + (geometry.to.x - geometry.from.x) * progress,
    y: geometry.from.y + (geometry.to.y - geometry.from.y) * progress,
    angle,
    scale,
    reveal: Math.max(0, Math.min(1, (progress - 0.65) / 0.35)),
    mode: progress >= 0.995 ? "demo" : progress > 0.015 ? "moving" : "hero",
  } as const;
}
