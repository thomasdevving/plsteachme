// Few-shot object enrollment and tracking on small video frames, entirely on
// the device. Enrollment learns what one learner's own object looks like from
// a few views: its colors relative to the surrounding background, and small
// grayscale shape templates. Tracking follows it with mean shift over a color
// likelihood map, checks it against the templates, and searches the whole
// frame to find it again after it was hidden.

export type Frame = { width: number; height: number; data: Uint8ClampedArray };
export type Box = { x: number; y: number; w: number; h: number }; // pixels of the analysis frame
export type ObjectModel = { likelihood: Float32Array; templates: Float32Array[]; width: number; height: number; frameWidth: number; frameHeight: number };
export type TrackState = { box: Box | null; score: number; status: 'tracking' | 'searching'; misses: number };
export const ANALYSIS_WIDTH = 160;
const HUE_BINS = 12, SAT_BINS = 3, GRAY_BINS = 6;
const BINS = HUE_BINS * SAT_BINS + GRAY_BINS;
const TEMPLATE = 16;
export const TRACK_THRESHOLD = 0.35;
const REACQUIRE_THRESHOLD = 0.45;
const MAX_MISSES = 5;

/** Color bin robust to lighting: hue and saturation for colors, brightness for grays. */
export function colorBin(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const value = max / 255, saturation = max ? (max - min) / max : 0;
  if (saturation < 0.25 || value < 0.15) return HUE_BINS * SAT_BINS + Math.min(GRAY_BINS - 1, Math.floor(value * GRAY_BINS));
  let hue = 0;
  const chroma = max - min;
  if (max === r) hue = ((g - b) / chroma + 6) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  const h = Math.min(HUE_BINS - 1, Math.floor((hue / 6) * HUE_BINS));
  const s = Math.min(SAT_BINS - 1, Math.floor(((saturation - 0.25) / 0.75) * SAT_BINS));
  return h * SAT_BINS + s;
}

export function clampBox(box: Box, frame: { width: number; height: number }): Box {
  const w = Math.max(4, Math.min(box.w, frame.width)), h = Math.max(4, Math.min(box.h, frame.height));
  return { x: Math.min(Math.max(0, box.x), frame.width - w), y: Math.min(Math.max(0, box.y), frame.height - h), w, h };
}
const grow = (box: Box, factor: number): Box => ({ x: box.x - (box.w * (factor - 1)) / 2, y: box.y - (box.h * (factor - 1)) / 2, w: box.w * factor, h: box.h * factor });

/** Kernel-weighted histogram of a box (center pixels count most), or of the ring around it. */
function histogram(frame: Frame, box: Box, ring = false) {
  const out = new Float32Array(BINS);
  const outer = ring ? clampBox(grow(box, 1.8), frame) : box;
  const x0 = Math.floor(outer.x), y0 = Math.floor(outer.y), x1 = Math.min(frame.width, Math.ceil(outer.x + outer.w)), y1 = Math.min(frame.height, Math.ceil(outer.y + outer.h));
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  let total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
    let weight = 1;
    if (ring) { if (inside) continue; }
    else { const dx = (x + 0.5 - cx) / (box.w / 2), dy = (y + 0.5 - cy) / (box.h / 2); weight = Math.max(0, 1 - dx * dx - dy * dy); if (!weight) continue; }
    const i = (y * frame.width + x) * 4;
    out[colorBin(frame.data[i], frame.data[i + 1], frame.data[i + 2])] += weight;
    total += weight;
  }
  if (total) for (let i = 0; i < BINS; i++) out[i] /= total;
  return out;
}

/** A zero-mean, unit-length grayscale thumbnail, so matching ignores brightness and contrast. */
function template(frame: Frame, box: Box) {
  const out = new Float32Array(TEMPLATE * TEMPLATE);
  for (let ty = 0; ty < TEMPLATE; ty++) for (let tx = 0; tx < TEMPLATE; tx++) {
    const x = Math.min(frame.width - 1, Math.max(0, Math.floor(box.x + ((tx + 0.5) * box.w) / TEMPLATE)));
    const y = Math.min(frame.height - 1, Math.max(0, Math.floor(box.y + ((ty + 0.5) * box.h) / TEMPLATE)));
    const i = (y * frame.width + x) * 4;
    out[ty * TEMPLATE + tx] = 0.299 * frame.data[i] + 0.587 * frame.data[i + 1] + 0.114 * frame.data[i + 2];
  }
  let mean = 0;
  for (const value of out) mean += value / out.length;
  let norm = 0;
  for (let i = 0; i < out.length; i++) { out[i] -= mean; norm += out[i] * out[i]; }
  norm = Math.sqrt(norm);
  if (norm > 1e-6) for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** Learns one object from a few views of the same box (few-shot enrollment). */
export function enroll(views: Frame[], box: Box): ObjectModel {
  if (!views.length) throw new Error('No enrollment views');
  const frame = views[0];
  const area = clampBox(box, frame);
  const object = new Float32Array(BINS), background = new Float32Array(BINS);
  for (const view of views) {
    const inner = histogram(view, area), ring = histogram(view, area, true);
    for (let i = 0; i < BINS; i++) { object[i] += inner[i] / views.length; background[i] += ring[i] / views.length; }
  }
  // Probability that a pixel of this color belongs to the object rather than its surroundings.
  const likelihood = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++) likelihood[i] = object[i] / (object[i] + background[i] + 1e-3);
  return { likelihood, templates: views.map((view) => template(view, area)), width: area.w, height: area.h, frameWidth: frame.width, frameHeight: frame.height };
}

function likelihoodMap(frame: Frame, model: ObjectModel) {
  const map = new Float32Array(frame.width * frame.height);
  for (let p = 0, i = 0; p < map.length; p++, i += 4) map[p] = model.likelihood[colorBin(frame.data[i], frame.data[i + 1], frame.data[i + 2])];
  return map;
}
function integral(map: Float32Array, width: number, height: number) {
  const out = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) { let row = 0; for (let x = 0; x < width; x++) { row += map[y * width + x]; out[(y + 1) * (width + 1) + x + 1] = out[y * (width + 1) + x + 1] + row; } }
  return out;
}
function boxMean(sums: Float64Array, width: number, box: Box) {
  const x0 = Math.round(box.x), y0 = Math.round(box.y), x1 = Math.round(box.x + box.w), y1 = Math.round(box.y + box.h);
  const stride = width + 1, area = Math.max(1, (x1 - x0) * (y1 - y0));
  return (sums[y1 * stride + x1] - sums[y0 * stride + x1] - sums[y1 * stride + x0] + sums[y0 * stride + x0]) / area;
}

/** How much a box looks like the enrolled object: color contrast with its surroundings plus shape. */
export function scoreBox(frame: Frame, model: ObjectModel, box: Box, sums: Float64Array = integral(likelihoodMap(frame, model), frame.width, frame.height)) {
  const area = clampBox(box, frame), outer = clampBox(grow(area, 1.8), frame);
  const inside = boxMean(sums, frame.width, area);
  const outerArea = outer.w * outer.h, innerArea = area.w * area.h;
  const ring = outerArea > innerArea ? (boxMean(sums, frame.width, outer) * outerArea - inside * innerArea) / (outerArea - innerArea) : 0;
  const color = Math.min(1, Math.max(0, (inside - ring) / 0.5));
  const thumb = template(frame, area);
  let shape = -1;
  for (const stored of model.templates) { let dot = 0; for (let i = 0; i < thumb.length; i++) dot += thumb[i] * stored[i]; shape = Math.max(shape, dot); }
  return 0.6 * color + 0.4 * Math.max(0, shape);
}

/** Mean shift: move the box toward the center of mass of object-colored pixels. */
function meanShift(frame: Frame, map: Float32Array, start: Box) {
  let box = start;
  for (let iteration = 0; iteration < 10; iteration++) {
    let sx = 0, sy = 0, total = 0;
    const area = clampBox(box, frame);
    for (let y = Math.floor(area.y); y < Math.min(frame.height, area.y + area.h); y++) for (let x = Math.floor(area.x); x < Math.min(frame.width, area.x + area.w); x++) {
      const weight = map[y * frame.width + x] ** 2;
      sx += weight * x; sy += weight * y; total += weight;
    }
    if (!total) return area;
    const next = clampBox({ ...area, x: sx / total - area.w / 2 + 0.5, y: sy / total - area.h / 2 + 0.5 }, frame);
    const moved = Math.hypot(next.x - area.x, next.y - area.y);
    box = next;
    if (moved < 0.5) break;
  }
  return box;
}

/** Scans the whole frame for the best-matching box, for (re)acquiring the object. */
function search(frame: Frame, model: ObjectModel, sums: Float64Array) {
  const candidates: { box: Box; color: number }[] = [];
  const scaleX = frame.width / model.frameWidth, scaleY = frame.height / model.frameHeight;
  for (const scale of [0.75, 1, 1.33]) {
    const w = Math.max(6, model.width * scaleX * scale), h = Math.max(6, model.height * scaleY * scale);
    if (w > frame.width || h > frame.height) continue;
    for (let y = 0; y + h <= frame.height; y += 3) for (let x = 0; x + w <= frame.width; x += 3) candidates.push({ box: { x, y, w, h }, color: boxMean(sums, frame.width, { x, y, w, h }) });
  }
  candidates.sort((a, b) => b.color - a.color);
  let best: { box: Box; score: number } | null = null;
  for (const candidate of candidates.slice(0, 6)) {
    const score = scoreBox(frame, model, candidate.box, sums);
    if (!best || score > best.score) best = { box: candidate.box, score };
  }
  return best;
}

export function initialState(): TrackState { return { box: null, score: 0, status: 'searching', misses: 0 }; }

/** Advances tracking by one frame. */
export function track(frame: Frame, model: ObjectModel, state: TrackState): TrackState {
  const map = likelihoodMap(frame, model);
  const sums = integral(map, frame.width, frame.height);
  if (state.box) {
    const shifted = meanShift(frame, map, state.box);
    // Allow gradual size changes as the object moves closer or further away.
    const minW = model.width * 0.4, maxW = model.width * 2.5;
    // A mild preference for the enrolled size keeps the box from drifting smaller or larger.
    const enrolledW = model.width * frame.width / model.frameWidth;
    const sizePenalty = (box: Box) => 0.08 * Math.abs(Math.log(box.w / enrolledW));
    let best = { box: shifted, score: scoreBox(frame, model, shifted, sums), rank: 0 };
    best.rank = best.score - sizePenalty(shifted);
    for (const factor of [0.9, 1.1]) {
      const resized = clampBox(grow(shifted, factor), frame);
      if (resized.w < minW || resized.w > maxW) continue;
      const score = scoreBox(frame, model, resized, sums), rank = score - sizePenalty(resized);
      if (rank > best.rank) best = { box: resized, score, rank };
    }
    if (best.score >= TRACK_THRESHOLD) return { box: best.box, score: best.score, status: 'tracking', misses: 0 };
    const misses = state.misses + 1;
    if (misses < MAX_MISSES) return { box: best.box, score: best.score, status: 'tracking', misses };
  }
  // Lost, or never found: look everywhere, but require a stronger match before claiming it.
  const found = search(frame, model, sums);
  if (found && found.score >= REACQUIRE_THRESHOLD) return { box: found.box, score: found.score, status: 'tracking', misses: 0 };
  return { box: null, score: found?.score ?? 0, status: 'searching', misses: 0 };
}
