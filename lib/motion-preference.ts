"use client";

import { useSyncExternalStore } from "react";

export const MOTION_KEY = "plsteach-motion-paused";
export const MOTION_EVENT = "plsteach:motion-preference";

export function motionIsPaused() {
  return typeof document !== "undefined" && document.documentElement.dataset.motionPaused === "true";
}

export function setMotionPaused(paused: boolean, persist = true) {
  document.documentElement.dataset.motionPaused = String(paused);
  if (persist) {
    try { localStorage.setItem(MOTION_KEY, String(paused)); } catch { /* Preference still works for this visit. */ }
  }
  window.dispatchEvent(new Event(MOTION_EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(MOTION_EVENT, listener);
  return () => window.removeEventListener(MOTION_EVENT, listener);
}

export function useMotionPaused() {
  return useSyncExternalStore(subscribe, motionIsPaused, () => false);
}
