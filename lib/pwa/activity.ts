'use client';
import { useSyncExternalStore } from 'react';

// Whether camera coaching is running in this window. An app update waits for it.
let cameraActive = false;
const listeners = new Set<() => void>();
export function setCameraActive(active: boolean) {
  if (cameraActive === active) return;
  cameraActive = active;
  for (const listener of listeners) listener();
}
export function useCameraActive() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => cameraActive, () => false);
}
