"use client";
import { skillIds, type SkillId } from "./config";
import {
  PROGRESS_EVENT,
  parseProgress,
  readProgress,
  saveLessonProgress,
} from "./learning-progress";
import { fetchWithTimeout } from "./network";
import { setSyncStatus } from "./progress-sync-status";

// Signed-in learners keep their lesson progress across devices. The browser
// copy stays the working copy; the account copy is merged in on load and
// kept up to date. The newer change wins.
const META_KEY = "plsteach.progress-sync.v1";
const PUBLISHED_PREFIX = "plsteach.published-progress.v1.";
type Entry = { data: unknown; updatedAt: number };
type Remote = { lessonKey: string; data: unknown; updatedAt: number };

function readMeta(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
function writeMeta(meta: Record<string, number>) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* Sync continues for this visit. */
  }
}

/** Built-in lessons carry their own change time; published lessons use the sync record. */
export function localEntries(): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const meta = readMeta();
  for (const [skill, lesson] of Object.entries(readProgress().lessons))
    if (lesson)
      entries.set(`builtin:${skill}`, {
        data: lesson,
        updatedAt: lesson.updatedAt,
      });
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match =
        key &&
        /^plsteach\.published-progress\.v1\.([a-f0-9-]{36})\.(\d+)$/.exec(key);
      if (!match) continue;
      const lessonKey = `published:${match[1]}:v${match[2]}`;
      entries.set(lessonKey, {
        data: JSON.parse(localStorage.getItem(key!) || "null"),
        updatedAt: meta[lessonKey] || 0,
      });
    }
  } catch {
    /* Unreadable entries are skipped. */
  }
  return entries;
}

/** Applies an account copy to this browser after validating it like any stored value. */
export function applyRemote(remote: Remote) {
  const builtin = /^builtin:([a-z]+)$/.exec(remote.lessonKey);
  if (builtin) {
    const skill = builtin[1] as SkillId;
    if (!skillIds.includes(skill)) return false;
    const lesson = parseProgress(
      JSON.stringify({ version: 1, lessons: { [skill]: remote.data } }),
    ).lessons[skill];
    return lesson ? saveLessonProgress(skill, lesson) : false;
  }
  const published = /^published:([a-f0-9-]{36}):v(\d+)$/.exec(remote.lessonKey);
  const data = remote.data as {
    step?: unknown;
    completed?: unknown;
    results?: unknown;
  } | null;
  if (
    !published ||
    !data ||
    !Number.isInteger(data.step) ||
    typeof data.completed !== "boolean" ||
    !Array.isArray(data.results)
  )
    return false;
  try {
    localStorage.setItem(
      `${PUBLISHED_PREFIX}${published[1]}.${published[2]}`,
      JSON.stringify({
        step: data.step,
        completed: data.completed,
        results: data.results,
      }),
    );
    const meta = readMeta();
    meta[remote.lessonKey] = remote.updatedAt;
    writeMeta(meta);
    return true;
  } catch {
    return false;
  }
}

/** Starts syncing for a signed-in learner. Returns a cleanup function. */
export function startProgressSync() {
  const abort = new AbortController();
  let stopped = false,
    applying = false,
    initialized = false,
    running = false,
    again = false,
    failures = 0;
  const sent = new Map<string, string>();
  const observed = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const status = (value: "idle" | "syncing" | "error") => {
    if (!stopped) setSyncStatus(value);
  };
  // Stamp published edits when they happen, never when retrying an old upload.
  const stampChanges = () => {
    const meta = readMeta();
    for (const [key, entry] of localEntries()) {
      const serialized = JSON.stringify(entry.data);
      if (
        key.startsWith("published:") &&
        ((!observed.has(key) && !meta[key]) ||
          (observed.has(key) && observed.get(key) !== serialized))
      )
        meta[key] = Date.now();
      observed.set(key, serialized);
    }
    writeMeta(meta);
  };
  const schedule = (delay: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  };
  async function flush() {
    if (stopped || navigator.onLine === false) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    status("syncing");
    try {
      if (!initialized) {
        const response = await fetchWithTimeout("/api/progress", {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Progress unavailable");
        const { progress } = (await response.json()) as { progress: Remote[] };
        if (!Array.isArray(progress)) throw new Error("Invalid progress");
        if (stopped) return;
        const local = localEntries();
        applying = true;
        try {
          for (const remote of progress) {
            const mine = local.get(remote.lessonKey);
            if (!mine || remote.updatedAt > mine.updatedAt) applyRemote(remote);
          }
          window.dispatchEvent(new Event(PROGRESS_EVENT));
        } finally {
          applying = false;
        }
        const remoteByKey = new Map(
          progress.map((item) => [item.lessonKey, item]),
        );
        for (const [key, entry] of localEntries()) {
          const serialized = JSON.stringify(entry.data);
          const remote = remoteByKey.get(key);
          if (remote && remote.updatedAt >= entry.updatedAt)
            sent.set(key, serialized);
          observed.set(key, serialized);
        }
        initialized = true;
      }
      // Serialize requests, and acknowledge only successful writes. Edits made
      // while a request is pending remain different from this acknowledged copy.
      for (const [key, entry] of localEntries()) {
        const serialized = JSON.stringify(entry.data);
        if (sent.get(key) === serialized) continue;
        const response = await fetchWithTimeout("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonKey: key,
            data: entry.data,
            updatedAt: entry.updatedAt,
          }),
          signal: abort.signal,
          keepalive: true,
        });
        if (!response.ok) throw new Error("Progress not saved");
        if (stopped) return;
        sent.set(key, serialized);
      }
      failures = 0;
      status("idle");
    } catch {
      if (!stopped) {
        again = false;
        status("error");
        schedule(Math.min(60_000, 5000 * 2 ** Math.min(failures++, 4)));
      }
    } finally {
      running = false;
      if (again && !stopped) {
        again = false;
        schedule(0);
      }
    }
  }
  const changed = () => {
    if (stopped || applying) return;
    stampChanges();
    schedule(800);
  };
  const retry = () => {
    if (!stopped) {
      if (timer) clearTimeout(timer);
      timer = null;
      void flush();
    }
  };
  stampChanges();
  // Install listeners before the initial GET: an outage must not disable sync
  // for the rest of the visit. Cleanup also cancels requests and retry timers.
  window.addEventListener(PROGRESS_EVENT, changed);
  window.addEventListener("online", retry);
  window.addEventListener("focus", retry);
  window.addEventListener("plsteach:retry-progress", retry);
  void flush();
  return () => {
    stopped = true;
    abort.abort();
    if (timer) clearTimeout(timer);
    window.removeEventListener(PROGRESS_EVENT, changed);
    window.removeEventListener("online", retry);
    window.removeEventListener("focus", retry);
    window.removeEventListener("plsteach:retry-progress", retry);
    setSyncStatus("idle");
  };
}
