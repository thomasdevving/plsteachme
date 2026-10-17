// Visible alpha bounds, with 2px padding, measured from the 1254px source atlas.
// anchorY is the actual contact point: feet, palms, or reclining body.
export const mascotFrames = {
  waving: {
    color: "orange",
    x: 130,
    y: 59,
    width: 423,
    height: 549,
    anchorY: 606,
  },
  peeking: {
    color: "green",
    x: 695,
    y: 151,
    width: 437,
    height: 409,
    anchorY: 537,
  },
  lounging: {
    color: "orange",
    x: 50,
    y: 757,
    width: 568,
    height: 369,
    anchorY: 1120,
  },
  "cross-legged": {
    color: "green",
    x: 755,
    y: 694,
    width: 371,
    height: 483,
    anchorY: 1175,
  },
} as const;

export function mascotFrameStyle(pose: keyof typeof mascotFrames) {
  const frame = mascotFrames[pose];
  return {
    aspectRatio: `${frame.width} / ${frame.height}`,
    "--seat-drop": `calc(var(--mascot-size) * ${(frame.y + frame.height - frame.anchorY) / frame.width})`,
    "--sprite-size": `${(1254 / frame.width) * 100}% ${(1254 / frame.height) * 100}%`,
    "--sprite-position": `${(frame.x / (1254 - frame.width)) * 100}% ${(frame.y / (1254 - frame.height)) * 100}%`,
    "--pose-pivot": `${((frame.anchorY - frame.y) / frame.height) * 100}%`,
  };
}
