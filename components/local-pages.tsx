"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  allLocal,
  deleteMyData,
  type SavedSession,
  type EvalRecord,
} from "@/lib/storage/store";
import { summarize, evalCSV } from "@/lib/storage/metrics";
import { liveCopy as c, copy } from "@/lib/copy/en";
import { PrivacyText } from "./consent";
import type { Skill } from "@/lib/skills/schema";
export function ProgressPage({ skills }: { skills: Skill[] }) {
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);
  useEffect(() => {
    void allLocal<SavedSession>("session:").then(setSessions);
  }, []);
  return (
    <main className="page-width utility-page">
      <h1>{c.progress}</h1>
      {sessions === null ? (
        <p role="status">{c.loadingPractice}</p>
      ) : sessions.length === 0 ? (
        <p>{c.emptyProgress}</p>
      ) : (
        skills
          .filter((s) => sessions.some((r) => r.skillId === s.id))
          .map((skill) => {
            const records = sessions
              .filter((s) => s.skillId === skill.id)
              .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
            const failures = new Map<string, number>();
            for (const session of records)
              for (const r of session.records)
                failures.set(
                  r.stepId,
                  (failures.get(r.stepId) ?? 0) +
                    r.failures +
                    r.uncertaintyRetries,
                );
            const hardest = [...failures].sort((a, b) => b[1] - a[1])[0];
            return (
              <section className="progress-entry" key={skill.id}>
                <h2>{skill.title}</h2>
                <p>{c.completedCount(records.length)}</p>
                <p>
                  {c.lastPracticed}:{" "}
                  {new Date(records[0].completedAt).toLocaleDateString()}
                </p>
                <p>
                  {c.mostRevisited}:{" "}
                  {hardest?.[1]
                    ? skill.steps.find((s) => s.id === hardest[0])?.title
                    : c.noRetries}
                </p>
                <p className="small-note">
                  {c.sessionModes(
                    records.filter((r) => r.mock).length,
                    records.filter((r) => r.mode === "walkthrough").length,
                  )}
                </p>
                <Link className="button primary" href={`/coach/skills/${skill.id}`}>
                  {copy.completion.again}
                </Link>
              </section>
            );
          })
      )}
      <Link className="quiet-link" href="/coach">
        {copy.common.home}
      </Link>
    </main>
  );
}
export function SettingsPage({ showEvaluation = false }: { showEvaluation?: boolean }) {
  const [message, setMessage] = useState("");
  return (
    <main className="page-width utility-page">
      <h1>{c.settings}</h1>
      <PrivacyText />
      <p>{c.privacyStorage}</p>
      <button
        className="button secondary"
        onClick={async () => {
          if (window.confirm(c.deleteConfirm)) {
            try {
              await deleteMyData();
              setMessage(c.deleted);
            } catch {
              setMessage(c.deleteError);
            }
          }
        }}
      >
        {c.delete}
      </button>
      <p role="status">{message}</p>
      {showEvaluation && (
        <Link className="quiet-link" href="/coach/eval">
          {c.eval}
        </Link>
      )}
    </main>
  );
}
const percentage = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;
export function EvaluationPage() {
  const [records, setRecords] = useState<EvalRecord[] | null>(null),
    [includeMock, setIncludeMock] = useState(false),
    [model, setModel] = useState("all");
  useEffect(() => {
    void allLocal<EvalRecord>("eval:").then(setRecords);
  }, []);
  const selected = (records ?? []).filter(
    (r) =>
      (includeMock || !r.result.mock) &&
      (model === "all" || r.result.model === model),
  );
  const summary = summarize(selected);
  function download(format: "json" | "csv") {
    const blob = new Blob(
      [
        format === "json"
          ? JSON.stringify(selected, null, 2)
          : evalCSV(selected),
      ],
      { type: format === "json" ? "application/json" : "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plsteach-eval-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="page-width eval-page">
      <h1>{c.evalTitle}</h1>
      <p className="lead">{c.evalIntro}</p>
      <div className="eval-controls">
        <label className="check-row">
          <input
            type="checkbox"
            checked={includeMock}
            onChange={(e) => setIncludeMock(e.target.checked)}
          />
          {c.includeMock}
        </label>
        <label>
          {c.model}
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="all">{c.allModels}</option>
            {[...new Set((records ?? []).map((r) => r.result.model))].map(
              (m) => (
                <option key={m}>{m}</option>
              ),
            )}
          </select>
        </label>
      </div>
      {records === null ? (
        <p role="status">{c.loadingEval}</p>
      ) : !records.length ? (
        <p>{c.emptyEval}</p>
      ) : (
        <>
          <dl className="metric-grid">
            <div>
              <dt>{c.labeledTotal}</dt>
              <dd>
                {summary.labeled} / {summary.total}
              </dd>
            </div>
            <div>
              <dt>{c.accuracy}</dt>
              <dd>{percentage(summary.accuracy)}</dd>
            </div>
            <div className="false-pass">
              <dt>{c.falsePass}</dt>
              <dd>{percentage(summary.falsePassRate)}</dd>
            </div>
            <div>
              <dt>{c.falseFail}</dt>
              <dd>{percentage(summary.falseFailRate)}</dd>
            </div>
            <div>
              <dt>{c.uncertain}</dt>
              <dd>{percentage(summary.uncertainRate)}</dd>
            </div>
            <div>
              <dt>{c.latency}</dt>
              <dd>
                {summary.p50 === null
                  ? "—"
                  : `${Math.round(summary.p50)} / ${Math.round(summary.p95!)} ms`}
              </dd>
            </div>
          </dl>
          <p className="small-note">{c.metricsNote}</p>
          <div className="table-scroll">
            <table>
              <caption>{c.resultsByStep}</caption>
              <thead>
                <tr>
                  <th>{c.step}</th>
                  <th>{c.total}</th>
                  <th>{c.labeled}</th>
                  <th>{c.accuracy}</th>
                  <th>{c.falsePasses}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set(selected.map((r) => `${r.skillId}/${r.stepId}`)),
                ].map((key) => {
                  const stats = summarize(
                    selected.filter((r) => `${r.skillId}/${r.stepId}` === key),
                  );
                  return (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{stats.total}</td>
                      <td>{stats.labeled}</td>
                      <td>{percentage(stats.accuracy)}</td>
                      <td className="false-pass">{stats.falsePass}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="secondary-actions">
            <button
              className="button secondary"
              onClick={() => download("json")}
            >
              {c.exportJSON}
            </button>
            <button
              className="button secondary"
              onClick={() => download("csv")}
            >
              {c.exportCSV}
            </button>
          </div>
          <p className="small-note">{c.exportNote}</p>
        </>
      )}
      <Link className="button primary" href="/coach/session/tie-four-in-hand?debug=1">
        {c.startEval}
      </Link>
    </main>
  );
}
