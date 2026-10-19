'use client';
import { extractFeatures } from './features';
import type { LandmarkFrame } from './prechecks';

type Landmarker = Awaited<ReturnType<typeof import('./mediapipe').createLandmarker>>;
let shared: Promise<Landmarker> | null = null;
/** One MediaPipe instance per page; the models are several megabytes. */
export function loadLandmarker() {
  shared ??= import('./mediapipe').then(({ createLandmarker }) => createLandmarker()).catch((error) => { shared = null; throw error; });
  return shared;
}

/** Runs hand and pose tracking on a playing video at a fixed rate and reports features. */
export function startLandmarkLoop(video: HTMLVideoElement, onFrame: (features: number[], frame: LandmarkFrame) => void, intervalMs = 100, onError?: () => void) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  void loadLandmarker().then((landmarker) => {
    const tick = () => {
      if (stopped) return;
      if (video.readyState >= 2 && !video.paused && video.videoWidth) {
        try { const frame = landmarker.detect(video, performance.now()); onFrame(extractFeatures(frame), frame); } catch { /* A dropped frame only skips one sample. */ }
      }
      timer = setTimeout(tick, intervalMs);
    };
    tick();
  }).catch(() => { if (!stopped) onError?.(); });
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
