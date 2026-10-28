"use client";
import { useSyncExternalStore } from "react";

type SyncStatus = "idle" | "syncing" | "error";
let status: SyncStatus = "idle";
const listeners = new Set<() => void>();
export function setSyncStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}
export function useProgressSyncStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => status,
    () => "idle" as SyncStatus,
  );
}
export function retryProgressSync() {
  window.dispatchEvent(new Event("plsteach:retry-progress"));
}
