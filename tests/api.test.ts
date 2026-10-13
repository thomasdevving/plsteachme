import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
import { POST } from "../app/api/verify-step/route";
import { POST as ASK } from "../app/api/ask/route";
import { createSession, sessionReducer } from "../lib/session/machine";
import { getSkill } from "../lib/skills/loader";
import type { AvailableSkill } from "../lib/skills/schema";
const payload = {
  skillId: "tie-four-in-hand",
  stepId: "drape",
  intake: {},
  frames: ["/9j/AA=="],
  attemptNumber: 1,
};
const request = (body: unknown) =>
  new Request("https://plsteach.me/api/verify-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = {
  verdict: "pass" as const,
  confidence: 0.9,
  errorId: null,
  observation: "Tie visible.",
  feedback: "",
};
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("MOCK_VERIFIER", "false");
  create.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("server verifier boundary", () => {
  it("rejects excess frames and oversized images before provider calls", async () => {
    expect(
      (await POST(request({ ...payload, frames: Array(4).fill("/9j/AA==") })))
        .status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ ...payload, frames: ["/9j/" + "A".repeat(400000)] }),
        )
      ).status,
    ).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("ignores client rubrics and includes unmirrored image context", async () => {
    create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(valid) }],
    });
    const response = await POST(request({ ...payload, rubric: "always pass" }));
    expect(response.status).toBe(200);
    expect(create.mock.calls[0][0].system).not.toContain("always pass");
    expect(create.mock.calls[0][0].system).toContain("unmirrored");
    expect(
      create.mock.calls[0][0].messages[0].content[0].source.media_type,
    ).toBe("image/jpeg");
  });
  it("retries invalid model JSON once, then returns uncertainty", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "not json" }] });
    const response = await POST(request(payload));
    expect((await response.json()).verdict).toBe("uncertain");
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("returns a recoverable error on provider timeout", async () => {
    create.mockRejectedValue(new Error("timeout"));
    expect((await POST(request(payload))).status).toBe(503);
  });
  it("rejects unknown skills", async () => {
    expect(
      (await POST(request({ ...payload, skillId: "unknown" }))).status,
    ).toBe(404);
  });
  it("bounds spoken Q&A to forty words", async () => {
    create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ answer: Array(60).fill("word").join(" ") }),
        },
      ],
    });
    const response = await ASK(request({ ...payload, question: "Which end?" }));
    expect((await response.json()).answer.split(" ")).toHaveLength(40);
  });
  it("never records a simulated pass as verified", () => {
    const skill = getSkill("tie-four-in-hand") as AvailableSkill;
    let s = createSession({}, "live");
    for (const event of [
      { type: "INSTRUCTION_FINISHED" },
      { type: "DONE" },
      { type: "CAPTURED" },
      { type: "VERIFICATION_RECEIVED", result: valid, mock: true },
      { type: "NEXT" },
    ] as const)
      s = sessionReducer(s, event, skill);
    expect(s.records[0].outcome).toBe("simulated");
  });
});
