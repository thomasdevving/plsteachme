import type { EvalRecord } from "./store";
export function summarize(records: EvalRecord[]) {
  const labeled = records.filter((r) => r.truth);
  const falsePass = labeled.filter(
    (r) => r.result.verdict === "pass" && r.truth === "fail",
  ).length;
  const falseFail = labeled.filter(
    (r) => r.result.verdict === "fail" && r.truth === "pass",
  ).length;
  const actualFail = labeled.filter((r) => r.truth === "fail").length,
    actualPass = labeled.filter((r) => r.truth === "pass").length;
  const latencies = records.map((r) => r.clientLatencyMs).sort((a, b) => a - b);
  const percentile = (p: number) =>
    latencies.length
      ? latencies[Math.max(0, Math.ceil(p * latencies.length) - 1)]
      : null;
  return {
    total: records.length,
    labeled: labeled.length,
    accuracy: labeled.length
      ? labeled.filter(
          (r) =>
            r.result.verdict === r.truth &&
            (r.truth !== "fail" ||
              !r.truthErrorId ||
              r.result.errorId === r.truthErrorId),
        ).length / labeled.length
      : null,
    falsePass,
    falseFail,
    falsePassRate: actualFail ? falsePass / actualFail : null,
    falseFailRate: actualPass ? falseFail / actualPass : null,
    uncertainRate: records.length
      ? records.filter((r) => r.result.verdict === "uncertain").length /
        records.length
      : null,
    p50: percentile(0.5),
    p95: percentile(0.95),
  };
}
export function evalCSV(records: EvalRecord[]) {
  const headers = [
    "id",
    "timestamp",
    "skill",
    "step",
    "model",
    "mock",
    "verdict",
    "confidence",
    "errorId",
    "humanCorrect",
    "truth",
    "truthErrorId",
    "clientLatencyMs",
    "serverLatencyMs",
    "manualOverride",
  ];
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+\-@]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    headers,
    ...records.map((r) => [
      r.id,
      r.timestamp,
      r.skillId,
      r.stepId,
      r.result.model,
      r.result.mock,
      r.result.verdict,
      r.result.confidence,
      r.result.errorId,
      r.humanCorrect,
      r.truth,
      r.truthErrorId,
      r.clientLatencyMs,
      r.result.latencyMs,
      r.manualOverride,
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
