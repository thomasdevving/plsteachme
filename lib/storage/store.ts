import { createStore, get, set, del, clear, entries, update } from "idb-keyval";
import type { SessionContext, StepRecord } from "../session/machine";
import type { AvailableSkill } from "../skills/schema";
import type { VerificationResponse } from "../ai/schemas";
let instance: ReturnType<typeof createStore> | undefined;
const store = () => (instance ??= createStore("plsteach-me", "local"));
export async function readLocal<T>(key: string): Promise<T | undefined> {
  try {
    return await get<T>(key, store());
  } catch {
    return undefined;
  }
}
export async function writeLocal(key: string, value: unknown) {
  try {
    await set(key, value, store());
    return true;
  } catch {
    return false;
  }
}
export async function removeLocal(key: string) {
  try {
    await del(key, store());
  } catch {
    /* Memory-only fallback. */
  }
}
export async function allLocal<T>(prefix: string): Promise<T[]> {
  try {
    return (await entries<string, T>(store()))
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value);
  } catch {
    return [];
  }
}
export type SavedSession = {
  id: string;
  skillId: string;
  completedAt: string;
  mode: "live" | "walkthrough";
  mock: boolean;
  records: StepRecord[];
};
export async function completeSession(
  id: string,
  skill: AvailableSkill,
  context: SessionContext,
  mock: boolean,
) {
  return writeLocal(`session:${id}`, {
    id,
    skillId: skill.id,
    completedAt: new Date().toISOString(),
    mode: context.mode,
    mock,
    records: context.records,
  } satisfies SavedSession);
}
export type Truth = "pass" | "fail" | "not_visible" | "uncertain";
export type EvalRecord = {
  id: string;
  timestamp: string;
  skillId: string;
  stepId: string;
  result: VerificationResponse;
  clientLatencyMs: number;
  humanCorrect?: boolean;
  truth?: Truth;
  truthErrorId?: string;
  frames?: string[];
  manualOverride?: boolean;
};
export async function labelEval(
  id: string,
  patch: Partial<
    Pick<
      EvalRecord,
      "humanCorrect" | "truth" | "truthErrorId" | "manualOverride"
    >
  >,
) {
  try {
    await update<EvalRecord>(
      `eval:${id}`,
      (record) => (record ? { ...record, ...patch } : record!),
      store(),
    );
    return true;
  } catch {
    return false;
  }
}
export async function deleteMyData() {
  let failed=false;
  try { await clear(store()); } catch { failed=true; }
  for (const area of ['sessionStorage','localStorage'] as const) {
    try {
      const storage=window[area];
      for (const key of Object.keys(storage))
        if (/^plsteach(?:\.me:|[.:])/.test(key) || key==='plsteach-motion-paused') storage.removeItem(key);
    } catch { failed=true; }
  }
  document.documentElement.dataset.motionPaused='false';
  window.dispatchEvent(new Event('plsteach-progress-change'));
  window.dispatchEvent(new Event('plsteach:motion-preference'));
  if(failed)throw new Error('Some local data could not be deleted.');
}
