"use client";
import { useSyncExternalStore } from "react";
import type { SkillId } from "../config";
import { APP_VERSION } from "../pwa/config";
import { getConnectivity, subscribeConnectivity } from "./connectivity";
import {
  CHANNEL,
  DownloadError,
  ESTIMATED_PACKAGE_BYTES,
  cleanupPackages,
  downloadPackage,
  failureMessages,
  listPackages,
  offlineSupported,
  removeAllPackages,
  removePackage,
  type DownloadFailure,
  type PackageKey,
  type StoredPackage,
} from "./packages";

export type LessonOfflineStatus =
  "online" | "downloading" | "offline" | "update" | "failed";
export const statusLabels: Record<LessonOfflineStatus, string> = {
  online: "Available online",
  downloading: "Downloading",
  offline: "Available offline",
  update: "Update available",
  failed: "Download failed",
};

export type OfflineState = {
  /** False until CacheStorage was read once. */
  ready: boolean;
  supported: boolean;
  packages: Partial<Record<PackageKey, StoredPackage>>;
  /** Packages whose files went missing; offered for a fresh download. */
  damaged: PackageKey[];
  downloads: Partial<Record<PackageKey, { done: number; total: number }>>;
  failures: Partial<
    Record<PackageKey, { reason: DownloadFailure; message: string }>
  >;
};

const EMPTY: OfflineState = {
  ready: false,
  supported: false,
  packages: {},
  damaged: [],
  downloads: {},
  failures: {},
};
let state: OfflineState = EMPTY;
let started = false;
const listeners = new Set<() => void>();
const controllers = new Map<PackageKey, AbortController>();
const tasks = new Map<PackageKey, Promise<DownloadError | null>>();
const shellWaiters = new Set<SkillId>();

function set(next: Partial<OfflineState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export async function refreshOffline() {
  // Development never runs the service worker, so a download could not be opened offline there.
  if (!offlineSupported() || process.env.NODE_ENV !== "production") {
    set({ ready: true, supported: false });
    return;
  }
  try {
    const { packages, damaged } = await listPackages();
    set({
      ready: true,
      supported: true,
      packages: Object.fromEntries(packages.map((item) => [item.key, item])),
      damaged,
    });
  } catch {
    set({ ready: true, supported: true });
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void (async () => {
    if (offlineSupported()) await cleanupPackages().catch(() => {});
    await refreshOffline();
    keepShellCurrent();
  })();
  window.addEventListener(CHANNEL, () => void refreshOffline());
  try {
    new BroadcastChannel(CHANNEL).onmessage = () => void refreshOffline();
  } catch {
    /* Older browsers. */
  }
  subscribeConnectivity(keepShellCurrent);
}

/** The newest version the app knows about: the server's, or this page's own. */
export function currentVersion() {
  return getConnectivity().latestVersion ?? APP_VERSION;
}

/** True when this window runs as the installed app. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * The offline library (a small public page) is what the app opens without a
 * connection. It is kept when the learner downloaded lessons or installed the
 * app, and refreshed in the background when a new version is deployed.
 */
function keepShellCurrent() {
  const connection = getConnectivity();
  if (
    !state.ready ||
    !state.supported ||
    !connection.online ||
    !connection.checked ||
    controllers.has("shell")
  )
    return;
  const hasLessons = Object.keys(state.packages).some((key) => key !== "shell");
  const shell = state.packages.shell;
  if (!hasLessons && !isStandalone()) return;
  if (shell && shell.info.version === currentVersion()) return;
  void download("shell", { quiet: true });
}

function download(
  key: PackageKey,
  {
    quiet = false,
    prepare,
  }: { quiet?: boolean; prepare?: (signal: AbortSignal) => Promise<void> } = {},
): Promise<DownloadError | null> {
  const existing = tasks.get(key);
  if (existing) return existing;
  const controller = new AbortController();
  controllers.set(key, controller);
  const { [key]: _failure, ...failures } = state.failures;
  set({
    failures,
    downloads: { ...state.downloads, [key]: { done: 0, total: 1 } },
  });
  const task = (async () => {
    try {
      if (!getConnectivity().online)
        throw new DownloadError("offline", failureMessages.offline);
      await prepare?.(controller.signal);
      controller.signal.throwIfAborted();
      const known = Object.values(state.packages).find(
        (item) => item?.key !== "shell",
      );
      await downloadPackage(key, {
        signal: controller.signal,
        expectedBytes: known?.info.bytes ?? ESTIMATED_PACKAGE_BYTES,
        onProgress: (done, total) =>
          set({ downloads: { ...state.downloads, [key]: { done, total } } }),
      });
      if (typeof navigator !== "undefined")
        void navigator.storage?.persist?.().catch(() => false);
      return null;
    } catch (error) {
      const failure = controller.signal.aborted
        ? new DownloadError("cancelled", failureMessages.cancelled)
        : error instanceof DownloadError
          ? error
          : new DownloadError("interrupted", failureMessages.interrupted);
      if (!quiet && failure.reason !== "cancelled")
        set({
          failures: {
            ...state.failures,
            [key]: { reason: failure.reason, message: failure.message },
          },
        });
      return failure;
    } finally {
      controllers.delete(key);
      const { [key]: _done, ...downloads } = state.downloads;
      set({ downloads });
      await refreshOffline();
    }
  })().finally(() => {
    if (tasks.get(key) === task) tasks.delete(key);
  });
  tasks.set(key, task);
  return task;
}

/** Waiting for a shared library is cancellable independently of other lessons. */
function waitForShell(
  task: Promise<DownloadError | null>,
  signal: AbortSignal,
) {
  return new Promise<DownloadError | null>((resolve, reject) => {
    const cancelled = () => {
      signal.removeEventListener("abort", cancelled);
      reject(new DownloadError("cancelled", failureMessages.cancelled));
    };
    if (signal.aborted) {
      cancelled();
      return;
    }
    signal.addEventListener("abort", cancelled, { once: true });
    task.then(
      (result) => {
        signal.removeEventListener("abort", cancelled);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener("abort", cancelled);
        reject(error);
      },
    );
  });
}

/** One cancellable operation covers both the library and the lesson files. */
export async function downloadLesson(skill: SkillId) {
  await download(skill, {
    prepare: async (signal) => {
      const shell = state.packages.shell;
      if (shell && shell.info.version === currentVersion()) return;
      shellWaiters.add(skill);
      try {
        const failure = await waitForShell(
          download("shell", { quiet: true }),
          signal,
        );
        signal.throwIfAborted();
        if (!state.packages.shell)
          throw (
            failure ??
            new DownloadError("interrupted", failureMessages.interrupted)
          );
      } finally {
        shellWaiters.delete(skill);
        // Cancel the initial library too when nobody else needs it. Installed
        // apps may still need that library as their offline start page.
        if (
          signal.aborted &&
          !shellWaiters.size &&
          !isStandalone() &&
          !Object.keys(state.packages).some((key) => key !== "shell")
        ) {
          controllers.get("shell")?.abort();
          await tasks.get("shell");
        }
      }
    },
  });
}

export function cancelDownload(key: PackageKey) {
  controllers.get(key)?.abort();
}

export async function removeLesson(skill: SkillId) {
  cancelDownload(skill);
  await tasks.get(skill);
  await removePackage(skill);
  const { [skill]: _failure, ...failures } = state.failures;
  set({ failures });
  await refreshOffline();
}

export async function removeAllLessons() {
  for (const controller of controllers.values()) controller.abort();
  await Promise.all([...tasks.values()]);
  await removeAllPackages();
  set({ failures: {} });
  await refreshOffline();
}

export function lessonStatus(
  snapshot: OfflineState,
  skill: SkillId,
  latestVersion: string,
): LessonOfflineStatus {
  if (snapshot.downloads[skill]) return "downloading";
  if (snapshot.failures[skill] || snapshot.damaged.includes(skill))
    return "failed";
  const item = snapshot.packages[skill];
  if (!item) return "online";
  return item.info.version === latestVersion ? "offline" : "update";
}

export function subscribeOffline(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getOfflineState() {
  return state;
}
export function useOfflineLessons() {
  return useSyncExternalStore(subscribeOffline, getOfflineState, () => EMPTY);
}

export function formatBytes(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
