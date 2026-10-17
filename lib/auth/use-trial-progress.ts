"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionContext } from "@/lib/session/machine";
import { writeLocal } from "@/lib/storage/store";
export type TrialAccess = { id: string; completedSteps: number };
export function useTrialProgress(
  trial: TrialAccess | undefined,
  context: SessionContext,
  totalSteps: number,
) {
  const completed =
    context.state === "COMPLETE" ? totalSteps : context.stepIndex;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const saved = useRef(trial?.completedSteps ?? 0);
  useEffect(() => {
    if (trial) void writeLocal(`trial:${trial.id}`, context);
  }, [trial, context]);
  useEffect(() => {
    if (!trial || completed <= saved.current) return;
    let active = true;
    setSaving(true);
    setError("");
    fetch("/api/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "progress",
        sessionId: trial.id,
        completedSteps: completed,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        if (active) saved.current = Math.max(saved.current, completed);
      })
      .catch(() => {
        if (active)
          setError(
            "Your progress could not be saved. Please retry before leaving.",
          );
      })
      .finally(() => {
        if (active) setSaving(false);
      });
    return () => {
      active = false;
    };
  }, [trial, completed, revision]);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  return { error, saving, retry };
}
