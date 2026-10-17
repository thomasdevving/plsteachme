import { it, expect } from "vitest";
import { summarize, evalCSV } from "../lib/storage/metrics";
import type { EvalRecord, Truth } from "../lib/storage/store";
import { parseCommand } from "../lib/speech/commands";
const record = (verdict: Truth, truth?: Truth, latency = 100): EvalRecord => ({
  id: "test",
  timestamp: "today",
  skillId: "tie",
  stepId: "drape",
  result: {
    verdict,
    confidence: 0.9,
    errorId: null,
    observation: "",
    feedback: "",
    latencyMs: 50,
    model: "sonnet",
    mock: false,
  },
  clientLatencyMs: latency,
  truth,
});
it("uses labeled truth denominators and nearest-rank percentiles", () => {
  const s = summarize([
    record("pass", "fail", 100),
    record("fail", "fail", 200),
    record("fail", "pass", 300),
    record("uncertain", undefined, 400),
  ]);
  expect(s.falsePassRate).toBe(0.5);
  expect(s.falseFailRate).toBe(1);
  expect(s.accuracy).toBeCloseTo(1 / 3);
  expect(s.uncertainRate).toBe(0.25);
  expect(s.p50).toBe(200);
  expect(s.p95).toBe(400);
});
it("does not invent percentages when there are no labels", () => {
  expect(summarize([]).accuracy).toBeNull();
  expect(summarize([record("pass")]).falsePassRate).toBeNull();
});
it("exports quoted CSV without frames and neutralizes spreadsheet formulas", () => {
  const r = record("pass");
  r.stepId = "=unsafe";
  r.frames = ["private"];
  const csv = evalCSV([r]);
  expect(csv).toContain("'=unsafe");
  expect(csv).not.toContain("private");
});
it("recognizes English and Dutch commands and questions", () => {
  expect(parseCommand("Klaar!")).toEqual({ command: "done" });
  expect(parseCommand("laat zien")).toEqual({ command: "show" });
  expect(parseCommand("Why is it loose?")).toEqual({
    question: "Why is it loose?",
  });
  expect(parseCommand("random noise")).toBeNull();
});
