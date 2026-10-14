"use client";
import { useState } from "react";
import Link from "next/link";
import type { EvalRecord, Truth } from "@/lib/storage/store";
import { labelEval } from "@/lib/storage/store";
import type { SkillStep } from "@/lib/skills/schema";
import { liveCopy as c } from "@/lib/copy/en";
export function EvalPanel({
  record,
  frames,
  step,
  state,
  prechecks,
  model,
  setModel,
  saveFrames,
  setSaveFrames,
}: {
  record: EvalRecord | null;
  frames: string[];
  step: SkillStep;
  state: string;
  prechecks: unknown;
  model: "sonnet" | "haiku";
  setModel: (v: "sonnet" | "haiku") => void;
  saveFrames: boolean;
  setSaveFrames: (v: boolean) => void;
}) {
  const [correct, setCorrect] = useState<boolean | null>(null),
    [truth, setTruth] = useState<Truth>("pass"),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  async function save() {
    if (!record || correct === null) return;
    const ok = await labelEval(record.id, {
      humanCorrect: correct,
      truth: correct ? record.result.verdict : truth,
      truthErrorId: (correct ? record.result.errorId : error) ?? undefined,
    });
    setSaved(ok ? c.savedLabel : c.storageError);
  }
  return (
    <details className="debug-panel" open>
      <summary>{c.eval}</summary>
      <p>{state}</p>
      <pre>{JSON.stringify(prechecks, null, 2)}</pre>
      <label>
        {c.model}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as "sonnet" | "haiku")}
        >
          <option value="sonnet">Sonnet</option>
          <option value="haiku">Haiku</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={saveFrames}
          onChange={(e) => setSaveFrames(e.target.checked)}
        />
        {c.saveFrames}
      </label>
      <p className="small-note">{c.framesWarning}</p>
      {record && (
        <div key={record.id}>
          <div className="frame-thumbnails">
            {frames.map((frame, i) => (
              <img
                key={i}
                src={`data:image/jpeg;base64,${frame}`}
                alt={c.frameAlt(i + 1)}
              />
            ))}
          </div>
          <pre>{JSON.stringify(record.result, null, 2)}</pre>
          <p>{c.timing(record.clientLatencyMs, record.result.latencyMs)}</p>
          <div className="secondary-actions">
            <button
              className="button secondary"
              aria-pressed={correct === true}
              onClick={() => {
                setCorrect(true);
                setSaved("");
              }}
            >
              {c.correct}
            </button>
            <button
              className="button secondary"
              aria-pressed={correct === false}
              onClick={() => {
                setCorrect(false);
                setSaved("");
              }}
            >
              {c.wrong}
            </button>
          </div>
          {correct === false && (
            <>
              <label>
                {c.truth}
                <select
                  value={truth}
                  onChange={(e) => setTruth(e.target.value as Truth)}
                >
                  {["pass", "fail", "not_visible", "uncertain"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {truth === "fail" && (
                <label>
                  {c.truthError}
                  <select
                    value={error}
                    onChange={(e) => setError(e.target.value)}
                  >
                    <option value="">{c.chooseError}</option>
                    {step.rubric.commonErrors.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.description}
                      </option>
                    ))}
                    <option value="other">{c.other}</option>
                  </select>
                </label>
              )}
            </>
          )}
          <button
            className="button primary"
            disabled={
              correct === null ||
              (correct === false && truth === "fail" && !error)
            }
            onClick={save}
          >
            {c.saveLabel}
          </button>
          <p role="status">{saved}</p>
        </div>
      )}
      <Link className="quiet-link" href="/coach/eval">
        {c.evalTitle}
      </Link>
    </details>
  );
}
