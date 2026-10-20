'use client';
import { skillIds, type SkillId } from './config';
import { PROGRESS_EVENT, parseProgress, readProgress, saveLessonProgress } from './learning-progress';

// Signed-in learners keep their lesson progress across devices. The browser
// copy stays the working copy; the account copy is merged in on load and
// kept up to date. The newer change wins.
const META_KEY = 'plsteach.progress-sync.v1';
const PUBLISHED_PREFIX = 'plsteach.published-progress.v1.';
type Entry = { data: unknown; updatedAt: number };
type Remote = { lessonKey: string; data: unknown; updatedAt: number };

function readMeta(): Record<string, number> {
  try { const value = JSON.parse(localStorage.getItem(META_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
}
function writeMeta(meta: Record<string, number>) { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* Sync continues for this visit. */ } }

/** Built-in lessons carry their own change time; published lessons use the sync record. */
export function localEntries(): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const meta = readMeta();
  for (const [skill, lesson] of Object.entries(readProgress().lessons)) if (lesson) entries.set(`builtin:${skill}`, { data: lesson, updatedAt: lesson.updatedAt });
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match = key && /^plsteach\.published-progress\.v1\.([a-f0-9-]{36})\.(\d+)$/.exec(key);
      if (!match) continue;
      const lessonKey = `published:${match[1]}:v${match[2]}`;
      entries.set(lessonKey, { data: JSON.parse(localStorage.getItem(key!) || 'null'), updatedAt: meta[lessonKey] || 0 });
    }
  } catch { /* Unreadable entries are skipped. */ }
  return entries;
}

/** Applies an account copy to this browser after validating it like any stored value. */
export function applyRemote(remote: Remote) {
  const builtin = /^builtin:([a-z]+)$/.exec(remote.lessonKey);
  if (builtin) {
    const skill = builtin[1] as SkillId;
    if (!skillIds.includes(skill)) return false;
    const lesson = parseProgress(JSON.stringify({ version: 1, lessons: { [skill]: remote.data } })).lessons[skill];
    return lesson ? saveLessonProgress(skill, lesson) : false;
  }
  const published = /^published:([a-f0-9-]{36}):v(\d+)$/.exec(remote.lessonKey);
  const data = remote.data as { step?: unknown; completed?: unknown; results?: unknown } | null;
  if (!published || !data || !Number.isInteger(data.step) || typeof data.completed !== 'boolean' || !Array.isArray(data.results)) return false;
  try {
    localStorage.setItem(`${PUBLISHED_PREFIX}${published[1]}.${published[2]}`, JSON.stringify({ step: data.step, completed: data.completed, results: data.results }));
    const meta = readMeta(); meta[remote.lessonKey] = remote.updatedAt; writeMeta(meta);
    return true;
  } catch { return false; }
}

async function push(lessonKey: string, entry: Entry) {
  await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonKey, data: entry.data, updatedAt: entry.updatedAt }), keepalive: true });
}

/** Starts syncing for a signed-in learner. Returns a cleanup function. */
export function startProgressSync() {
  let stopped = false, applying = false;
  const sent = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    const meta = readMeta();
    for (const [key, entry] of localEntries()) {
      const serialized = JSON.stringify(entry.data);
      if (sent.get(key) === serialized) continue;
      // A published lesson changed here: stamp the change so it wins over older account copies.
      if (key.startsWith('published:')) { entry.updatedAt = Date.now(); meta[key] = entry.updatedAt; }
      sent.set(key, serialized);
      void push(key, entry).catch(() => sent.delete(key));
    }
    writeMeta(meta);
  };
  const changed = () => { if (stopped || applying) return; if (timer) clearTimeout(timer); timer = setTimeout(flush, 800); };
  void (async () => {
    try {
      const response = await fetch('/api/progress', { cache: 'no-store' });
      if (!response.ok || stopped) return;
      const { progress } = (await response.json()) as { progress: Remote[] };
      const local = localEntries();
      applying = true;
      for (const remote of progress) {
        const mine = local.get(remote.lessonKey);
        if (!mine || remote.updatedAt > mine.updatedAt) applyRemote(remote);
      }
      applying = false;
      // Anything newer here, or missing from the account, goes up.
      const remoteByKey = new Map(progress.map((item) => [item.lessonKey, item]));
      for (const [key, entry] of localEntries()) {
        const remote = remoteByKey.get(key);
        if (remote && remote.updatedAt >= entry.updatedAt) sent.set(key, JSON.stringify(entry.data));
      }
      window.addEventListener(PROGRESS_EVENT, changed);
      flush();
      window.dispatchEvent(new Event(PROGRESS_EVENT));
    } catch { applying = false; }
  })();
  return () => { stopped = true; if (timer) clearTimeout(timer); window.removeEventListener(PROGRESS_EVENT, changed); };
}
