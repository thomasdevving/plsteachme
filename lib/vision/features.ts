// Pose- and scale-invariant features from MediaPipe landmarks. These, not
// images, are what specialized models train on and what is stored.
import type { Point } from "./prechecks";

export const FEATURE_VERSION = 1;
const HAND_POINTS = 21;
const HAND_FEATURES = 1 + HAND_POINTS * 2 + 2; // presence, shape, position
const POSE_POINTS = [0, 13, 14, 15, 16]; // nose, elbows, wrists
export const FEATURE_LENGTH = HAND_FEATURES * 2 + 2 + POSE_POINTS.length * 2 + 1;

export type LandmarkInput = { pose: Point[]; hands: Point[][] };

const finite = (point?: Point) => Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));

/** Body reference: shoulder midpoint and width when visible, else the image. */
function reference(pose: Point[]) {
  const left = pose[11], right = pose[12];
  if (finite(left) && finite(right)) {
    const width = Math.hypot(left.x - right.x, left.y - right.y);
    if (width > 0.02) return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, scale: width, body: true };
  }
  return { x: 0.5, y: 0.5, scale: 0.5, body: false };
}

function handFeatures(hand: Point[] | undefined, origin: { x: number; y: number; scale: number }) {
  const out = new Array<number>(HAND_FEATURES).fill(0);
  if (!hand || hand.length < HAND_POINTS || !hand.slice(0, HAND_POINTS).every(finite)) return out;
  const wrist = hand[0];
  // Hand size: wrist to middle-finger knuckle keeps shape independent of distance.
  const size = Math.max(Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y), 1e-3);
  out[0] = 1;
  for (let i = 0; i < HAND_POINTS; i++) {
    out[1 + i * 2] = (hand[i].x - wrist.x) / size;
    out[2 + i * 2] = (hand[i].y - wrist.y) / size;
  }
  out[HAND_FEATURES - 2] = (wrist.x - origin.x) / origin.scale;
  out[HAND_FEATURES - 1] = (wrist.y - origin.y) / origin.scale;
  return out;
}

/**
 * A fixed-length vector: two hands ordered left-to-right in the image, the
 * vector between them, upper-body points relative to the shoulders, and a
 * body-visible flag. Missing parts are zeros with their presence flag off.
 */
export function extractFeatures(frame: LandmarkInput): number[] {
  const origin = reference(frame.pose);
  const hands = frame.hands.filter((hand) => hand.length >= HAND_POINTS && finite(hand[0])).slice(0, 2).sort((a, b) => a[0].x - b[0].x);
  const between = hands.length === 2 ? [(hands[1][0].x - hands[0][0].x) / origin.scale, (hands[1][0].y - hands[0][0].y) / origin.scale] : [0, 0];
  const pose = POSE_POINTS.flatMap((index) => {
    const point = frame.pose[index];
    return origin.body && finite(point) ? [(point.x - origin.x) / origin.scale, (point.y - origin.y) / origin.scale] : [0, 0];
  });
  return [...handFeatures(hands[0], origin), ...handFeatures(hands[1], origin), ...between, ...pose, origin.body ? 1 : 0].map((value) => Math.round(value * 1000) / 1000);
}

/** The same frame seen in a mirror: front cameras and selfie previews flip left and right. */
export function mirrorFeatures(features: number[]): number[] {
  const flipHand = (offset: number) => {
    const hand = features.slice(offset, offset + HAND_FEATURES);
    if (!hand[0]) return hand;
    for (let i = 0; i < HAND_POINTS; i++) hand[1 + i * 2] = -hand[1 + i * 2];
    hand[HAND_FEATURES - 2] = -hand[HAND_FEATURES - 2];
    return hand;
  };
  // Mirroring swaps which hand is leftmost in the image.
  const first = flipHand(0), second = flipHand(HAND_FEATURES);
  const ordered = second[0] ? [second, first] : [first, second];
  const between = features.slice(HAND_FEATURES * 2, HAND_FEATURES * 2 + 2);
  const poseStart = HAND_FEATURES * 2 + 2;
  const pose: number[] = [];
  // Swap left/right elbows and wrists, and negate x.
  const pairs = [0, 2, 1, 4, 3];
  for (const index of pairs) pose.push(-features[poseStart + index * 2], features[poseStart + index * 2 + 1]);
  // With two hands the order swaps too, so the horizontal gap keeps its sign and the vertical one flips.
  return [...ordered[0], ...ordered[1], between[0], -between[1], ...pose, features[FEATURE_LENGTH - 1]].map((value) => (Object.is(value, -0) ? 0 : value));
}

export function hasHands(features: number[]) {
  return features[0] === 1 || features[HAND_FEATURES] === 1;
}
