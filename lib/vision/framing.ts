import type { CameraSetup } from "../skills/schema";
import { enoughLight, visible, type LandmarkFrame } from "./prechecks";

export const framingCopy = {
  "upper-body": {
    title: "Neck to waist",
    guide: "Fit your neck, tie ends and raised hands inside the guide.",
  },
  neck: {
    title: "Collar and knot",
    guide: "Move closer: keep your collar and knot in the center.",
  },
  face: {
    title: "Face close-up",
    guide: "Position the camera at eye level with your face in the guide.",
  },
  tabletop: {
    title: "Hands and work surface",
    guide: "Point the camera down at your hands and the whole work area.",
  },
  feet: {
    title: "Shoes and hands",
    guide:
      "Point the camera down at your shoes. Keep the laces and hands in view.",
  },
} as const;

// Object-centered lessons must not be blocked by a missing upper body.
export function ambiguousSubject(frame: LandmarkFrame, camera: CameraSetup) {
  return (
    camera.requiredLandmarks.some((name) => !name.endsWith("Hand")) &&
    frame.ambiguous
  );
}
export function framingChecks(
  frame: LandmarkFrame | null,
  camera: CameraSetup,
) {
  const required = new Set(camera.requiredLandmarks);
  const checks: { id: string; label: string; ready: boolean }[] = [];
  const add = (id: string, label: string, ready: boolean) =>
    checks.push({ id, label, ready });
  if (required.has("leftShoulder") && required.has("rightShoulder")) {
    add(
      "shoulders",
      "Both shoulders visible",
      !!frame && visible(frame.pose[11]) && visible(frame.pose[12]),
    );
  } else {
    for (const [name, index, label] of [
      ["leftShoulder", 11, "Left shoulder visible"],
      ["rightShoulder", 12, "Right shoulder visible"],
    ] as const)
      if (required.has(name))
        add(name, label, !!frame && visible(frame.pose[index]));
  }
  if (required.has("nose"))
    add(
      "face",
      camera.framing === "face" ? "Face visible" : "Neck and collar in view",
      !!frame && visible(frame.pose[0]),
    );
  const handCount =
    Number(required.has("leftHand")) + Number(required.has("rightHand"));
  if (handCount)
    add(
      "hands",
      handCount === 2 ? "Both hands visible" : "Working hand visible",
      !!frame &&
        frame.hands.filter((h) => h.length === 21 && h.every(visible)).length >=
          handCount,
    );
  for (const [name, index, label] of [
    ["leftFoot", 31, "Left foot visible"],
    ["rightFoot", 32, "Right foot visible"],
  ] as const)
    if (required.has(name))
      add(name, label, !!frame && visible(frame.pose[index]));
  add(
    "light",
    "Enough light",
    !!frame && enoughLight(frame.luminance, camera.minLuminance),
  );
  return checks;
}
