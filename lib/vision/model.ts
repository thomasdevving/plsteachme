// A small, dependency-free neural network for classifying landmark features
// into lesson states (a step's correct result, a known mistake, or neither).
// Small enough to train on the server in seconds and run on any phone.
import { FEATURE_LENGTH, mirrorFeatures } from "./features";

export const MODEL_FORMAT = "plsteach-mlp-v1";
export type Clip = { id: string; label: string; frames: number[][] };
export type VisionModel = {
  format: typeof MODEL_FORMAT;
  featureLength: number;
  labels: string[];
  mean: number[];
  std: number[];
  w1: number[][]; // hidden x input
  b1: number[];
  w2: number[][]; // labels x hidden
  b2: number[];
};
export type LabelMetrics = { label: string; precision: number; recall: number; f1: number; support: number; clips: number };
export type Evaluation = {
  frameAccuracy: number;
  clipAccuracy: number;
  macroF1: number;
  perLabel: LabelMetrics[];
  confusion: number[][]; // actual x predicted, frames
  validationClips: number;
  trainingClips: number;
};
export type TrainOptions = { hidden: number; epochs: number; learningRate: number; l2: number; batch: number; seed: number; maxFramesPerClip: number; maxRows: number };
export const DEFAULT_TRAINING: TrainOptions = { hidden: 32, epochs: 40, learningRate: 0.01, l2: 1e-4, batch: 64, seed: 7, maxFramesPerClip: 45, maxRows: 6000 };

/** Deterministic random numbers, so the same dataset always trains the same model. */
export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(frames: number[][], max: number) {
  if (frames.length <= max) return frames;
  const step = frames.length / max;
  return Array.from({ length: max }, (_, i) => frames[Math.floor(i * step)]);
}

function softmax(logits: number[]) {
  const top = Math.max(...logits);
  const exps = logits.map((value) => Math.exp(value - top));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / sum);
}

export function predict(model: VisionModel, features: number[]): number[] {
  const input = features.map((value, i) => (value - model.mean[i]) / model.std[i]);
  const hidden = model.w1.map((row, j) => Math.max(0, row.reduce((sum, weight, i) => sum + weight * input[i], model.b1[j])));
  return softmax(model.w2.map((row, k) => row.reduce((sum, weight, j) => sum + weight * hidden[j], model.b2[k])));
}

/** Trains on all frames of the given clips. Mirrored copies make it work with front and back cameras. */
export function train(clips: Clip[], labels: string[], options: Partial<TrainOptions> = {}): VisionModel {
  const config = { ...DEFAULT_TRAINING, ...options };
  const random = rng(config.seed);
  const rows: { x: number[]; y: number }[] = [];
  // Bound total work: large datasets sample fewer frames from each clip.
  const perClip = Math.max(8, Math.min(config.maxFramesPerClip, Math.floor(config.maxRows / 2 / Math.max(1, clips.length))));
  for (const clip of clips) {
    const y = labels.indexOf(clip.label);
    if (y < 0) continue;
    for (const frame of sample(clip.frames, perClip)) {
      if (frame.length !== FEATURE_LENGTH) continue;
      rows.push({ x: frame, y }, { x: mirrorFeatures(frame), y });
    }
  }
  if (!rows.length) throw new Error("No training frames");
  const n = FEATURE_LENGTH, h = config.hidden, k = labels.length;
  const mean = new Array(n).fill(0), std = new Array(n).fill(0);
  for (const row of rows) row.x.forEach((value, i) => (mean[i] += value / rows.length));
  for (const row of rows) row.x.forEach((value, i) => (std[i] += (value - mean[i]) ** 2 / rows.length));
  // Constant columns (e.g. a hand that is always present) keep a unit scale.
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i]) < 1e-3 ? 1 : Math.sqrt(std[i]);
  const inputs = rows.map((row) => row.x.map((value, i) => (value - mean[i]) / std[i]));
  // Balance classes so a label with many frames does not drown out the rest.
  const counts = new Array(k).fill(0);
  rows.forEach((row) => counts[row.y]++);
  const weights = counts.map((count) => (count ? rows.length / (k * count) : 0));

  const init = (fanIn: number) => (random() * 2 - 1) * Math.sqrt(6 / fanIn);
  // Flat typed arrays keep training fast enough to run inside a request.
  const w1 = Float64Array.from({ length: h * n }, () => init(n)), b1 = new Float64Array(h);
  const w2 = Float64Array.from({ length: k * h }, () => init(h)), b2 = new Float64Array(k);
  const params = [w1, b1, w2, b2];
  const grads = params.map((p) => new Float64Array(p.length));
  const moments1 = params.map((p) => new Float64Array(p.length)), moments2 = params.map((p) => new Float64Array(p.length));
  const decay = [config.l2, 0, config.l2, 0];
  const beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8;
  const hiddenPre = new Float64Array(h), hidden = new Float64Array(h), logits = new Float64Array(k), dHidden = new Float64Array(h);
  const x = new Float64Array(n);
  let t = 0;
  const order = rows.map((_, i) => i);
  for (let epoch = 0; epoch < config.epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let start = 0; start < order.length; start += config.batch) {
      grads.forEach((g) => g.fill(0));
      const [g1, gb1, g2, gb2] = grads;
      let total = 0;
      for (let b = start; b < Math.min(start + config.batch, order.length); b++) {
        const index = order[b];
        x.set(inputs[index]);
        const y = rows[index].y, weight = weights[y];
        total += weight;
        for (let j = 0; j < h; j++) { let sum = b1[j]; const offset = j * n; for (let i = 0; i < n; i++) sum += w1[offset + i] * x[i]; hiddenPre[j] = sum; hidden[j] = sum > 0 ? sum : 0; }
        let top = -Infinity;
        for (let c = 0; c < k; c++) { let sum = b2[c]; const offset = c * h; for (let j = 0; j < h; j++) sum += w2[offset + j] * hidden[j]; logits[c] = sum; if (sum > top) top = sum; }
        let norm = 0;
        for (let c = 0; c < k; c++) { logits[c] = Math.exp(logits[c] - top); norm += logits[c]; }
        dHidden.fill(0);
        for (let c = 0; c < k; c++) {
          const d = (logits[c] / norm - (c === y ? 1 : 0)) * weight;
          gb2[c] += d;
          const offset = c * h;
          for (let j = 0; j < h; j++) { g2[offset + j] += d * hidden[j]; dHidden[j] += d * w2[offset + j]; }
        }
        for (let j = 0; j < h; j++) {
          if (hiddenPre[j] <= 0) continue;
          const d = dHidden[j], offset = j * n;
          gb1[j] += d;
          for (let i = 0; i < n; i++) g1[offset + i] += d * x[i];
        }
      }
      t++;
      const lr = config.learningRate * Math.sqrt(1 - beta2 ** t) / (1 - beta1 ** t);
      params.forEach((param, p) => {
        const grad = grads[p], m = moments1[p], v = moments2[p];
        for (let i = 0; i < param.length; i++) {
          const g = grad[i] / total + decay[p] * param[i];
          m[i] = beta1 * m[i] + (1 - beta1) * g;
          v[i] = beta2 * v[i] + (1 - beta2) * g * g;
          param[i] -= (lr * m[i]) / (Math.sqrt(v[i]) + epsilon);
        }
      });
    }
  }
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  const matrix = (values: Float64Array, cols: number) => Array.from({ length: values.length / cols }, (_, r) => Array.from(values.subarray(r * cols, (r + 1) * cols), round));
  return { format: MODEL_FORMAT, featureLength: n, labels, mean: mean.map(round), std: std.map(round), w1: matrix(w1, n), b1: Array.from(b1, round), w2: matrix(w2, h), b2: Array.from(b2, round) };
}

/**
 * Holds out whole clips per label. Frames of one recording are nearly
 * identical, so splitting frames instead would grossly overstate accuracy.
 */
export function splitByClip(clips: Clip[], seed = DEFAULT_TRAINING.seed, share = 0.25) {
  const random = rng(seed);
  const training: Clip[] = [], validation: Clip[] = [];
  const byLabel = new Map<string, Clip[]>();
  for (const clip of clips) byLabel.set(clip.label, [...(byLabel.get(clip.label) || []), clip]);
  for (const group of byLabel.values()) {
    const shuffled = [...group].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const held = shuffled.length >= 2 ? Math.max(1, Math.round(shuffled.length * share)) : 0;
    validation.push(...shuffled.slice(0, held));
    training.push(...shuffled.slice(held));
  }
  return { training, validation };
}

export function evaluate(model: VisionModel, clips: Clip[], trainingClips = 0): Evaluation {
  const k = model.labels.length;
  const confusion = Array.from({ length: k }, () => new Array(k).fill(0));
  let correctClips = 0, frames = 0, correctFrames = 0;
  for (const clip of clips) {
    const actual = model.labels.indexOf(clip.label);
    if (actual < 0) continue;
    const votes = new Array(k).fill(0);
    for (const frame of clip.frames) {
      const probs = predict(model, frame);
      const predicted = probs.indexOf(Math.max(...probs));
      confusion[actual][predicted]++;
      votes[predicted]++;
      frames++;
      if (predicted === actual) correctFrames++;
    }
    if (votes.indexOf(Math.max(...votes)) === actual) correctClips++;
  }
  const perLabel = model.labels.map((label, c) => {
    const tp = confusion[c][c];
    const predicted = confusion.reduce((sum, row) => sum + row[c], 0);
    const support = confusion[c].reduce((a, b) => a + b, 0);
    const precision = predicted ? tp / predicted : 0, recall = support ? tp / support : 0;
    return { label, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, support, clips: clips.filter((clip) => clip.label === label).length };
  });
  const scored = perLabel.filter((item) => item.support > 0);
  return {
    frameAccuracy: frames ? correctFrames / frames : 0,
    clipAccuracy: clips.length ? correctClips / clips.length : 0,
    macroF1: scored.length ? scored.reduce((sum, item) => sum + item.f1, 0) / scored.length : 0,
    perLabel, confusion, validationClips: clips.length, trainingClips,
  };
}

/** Smooths per-frame predictions over time so one noisy frame does not flip the result. */
export function createSmoother(labels: number, alpha = 0.3) {
  let state: number[] | null = null;
  return {
    push(probs: number[]) { state = state ? state.map((value, i) => (1 - alpha) * value + alpha * probs[i]) : [...probs]; return state; },
    reset() { state = null; },
    get value() { return state ?? new Array(labels).fill(1 / labels); },
  };
}
