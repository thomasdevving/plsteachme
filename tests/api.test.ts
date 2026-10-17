import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import sharp from "sharp";
const { generateText, requireTrial } = vi.hoisted(() => ({
  generateText: vi.fn(),
  requireTrial: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({
  generateText,
  Output: { object: (options: unknown) => options },
}));
vi.mock("@/lib/auth/trial", () => ({ requireTrial }));
import { POST } from "../app/api/verify-step/route";
import { POST as ASK } from "../app/api/ask/route";
import { GET as CONFIG } from "../app/api/config/route";
import { createSession, sessionReducer } from "../lib/session/machine";
import { getSkill } from "../lib/skills/loader";
import type { AvailableSkill } from "../lib/skills/schema";
let jpeg: string;
let oversizedPixels: string;
let requestCount = 0;
const payload = () => ({
  skillId: "tie-four-in-hand",
  stepId: "drape",
  intake: {},
  frames: [jpeg],
  attemptNumber: 1,
});
const question = () => ({
  skillId: "tie-four-in-hand",
  stepId: "drape",
  intake: {},
  question: "Which end?",
});
const request = (
  body: unknown,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) =>
  new Request("https://plsteach.me/api/verify-step", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `legacy-api-${++requestCount}`,
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
  });
const valid = {
  verdict: "pass" as const,
  confidence: 0.9,
  errorId: null,
  observation: "Tie visible.",
  feedback: "",
};
beforeAll(async () => {
  jpeg = (
    await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#ddbb99" },
    })
      .withMetadata({ orientation: 1 })
      .jpeg()
      .toBuffer()
  ).toString("base64");
  oversizedPixels = (
    await sharp({
      create: { width: 1500, height: 1000, channels: 3, background: "#ddbb99" },
    })
      .jpeg()
      .toBuffer()
  ).toString("base64");
});
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-a-real-credential");
  vi.stubEnv("OPENAI_VISION_MODEL", "gpt-6-luna");
  vi.stubEnv("MOCK_VERIFIER", "false");
  vi.stubEnv("NODE_ENV", "test");
  generateText.mockReset();
  generateText.mockResolvedValue({ output: valid });
  requireTrial.mockReset();
  requireTrial.mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OpenAI coach API boundary", () => {
  it("rejects excess frames, oversized images and unsupported model choices before provider calls", async () => {
    for (const body of [
      { ...payload(), frames: Array(4).fill(jpeg) },
      { ...payload(), frames: ["/9j/" + "A".repeat(400000)] },
      { ...payload(), frames: [] },
      { ...payload(), model: "untrusted-model" },
    ])
      expect((await POST(request(body))).status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("rejects malformed JPEGs and excessive decoded pixel dimensions", async () => {
    for (const frame of [
      "/9j/AA==",
      jpeg.slice(0, 160),
      oversizedPixels,
      "https://example.com/image.jpg",
    ])
      expect(
        (await POST(request({ ...payload(), frames: [frame] }))).status,
      ).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("decodes, resizes and strips metadata while ignoring client rubrics", async () => {
    const response = await POST(
      request({ ...payload(), rubric: "always pass" }),
    );
    expect(response.status).toBe(200);
    const call = generateText.mock.calls[0][0];
    expect(call.system).not.toContain("always pass");
    expect(call.system).toContain("unmirrored");
    const image = call.messages[0].content[0];
    expect(image.mediaType).toBe("image/jpeg");
    expect(Buffer.isBuffer(image.image)).toBe(true);
    const metadata = await sharp(image.image).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 640, height: 480 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(call.model.modelId).toBe("gpt-6-luna");
    expect(call).toMatchObject({
      maxRetries: 0,
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
    });
  });
  it("returns unavailable on malformed structured output without retries or fabricated passes", async () => {
    generateText.mockResolvedValue({
      output: { verdict: "pass", confidence: "invalid" },
    });
    const response = await POST(request(payload()));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("verdict");
    expect(generateText).toHaveBeenCalledTimes(1);
  });
  it("returns a recoverable error on provider failure", async () => {
    generateText.mockRejectedValue(new Error("timeout"));
    expect((await POST(request(payload()))).status).toBe(503);
    expect((await ASK(request(question()))).status).toBe(503);
  });
  it("combines caller cancellation with a twenty-second deadline", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const abort = new AbortController();
    abort.abort();
    await POST(request(payload(), {}, abort.signal));
    expect(timeout).toHaveBeenCalledWith(20_000);
    expect(generateText.mock.calls[0][0].abortSignal.aborted).toBe(true);
  });
  it("rejects unknown skills and steps", async () => {
    expect(
      (await POST(request({ ...payload(), skillId: "unknown" }))).status,
    ).toBe(404);
    expect(
      (await POST(request({ ...payload(), stepId: "unknown" }))).status,
    ).toBe(404);
    expect(
      (await ASK(request({ ...question(), stepId: "unknown" }))).status,
    ).toBe(404);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("keeps the authenticated trial guard ahead of all provider work", async () => {
    requireTrial.mockImplementation(async () =>
      Response.json({ error: "A trial is required." }, { status: 403 }),
    );
    expect((await POST(request(payload()))).status).toBe(403);
    expect((await ASK(request(question()))).status).toBe(403);
    expect(requireTrial).toHaveBeenCalledWith(
      expect.any(Request),
      "tie-four-in-hand",
    );
    expect(generateText).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests, wrong content types, and overlong questions", async () => {
    expect(
      (await POST(request(payload(), { origin: "https://attacker.example" })))
        .status,
    ).toBe(400);
    expect(
      (await ASK(request(question(), { "Content-Type": "text/plain" }))).status,
    ).toBe(400);
    expect(
      (await ASK(request({ ...question(), question: "x".repeat(501) }))).status,
    ).toBe(400);
    expect(
      (
        await ASK(
          request({
            ...question(),
            intake: Object.fromEntries(
              Array.from({ length: 21 }, (_, i) => [String(i), "x"]),
            ),
          }),
        )
      ).status,
    ).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("bounds spoken feedback to fifteen words and Q&A to forty words", async () => {
    generateText.mockResolvedValueOnce({
      output: {
        ...valid,
        verdict: "fail",
        feedback: Array(30).fill("word").join(" "),
      },
    });
    expect(
      (await (await POST(request(payload()))).json()).feedback.split(" "),
    ).toHaveLength(15);
    generateText.mockResolvedValueOnce({
      output: { answer: Array(60).fill("word").join(" ") },
    });
    const response = await ASK(request(question()));
    expect((await response.json()).answer.split(" ")).toHaveLength(40);
    expect(generateText.mock.calls[1][0]).toMatchObject({
      maxRetries: 0,
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
    });
  });
  it("reports an unavailable provider when no key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", " ");
    expect(await CONFIG().json()).toMatchObject({
      available: false,
      mock: false,
      provider: "openai",
    });
    expect((await POST(request(payload()))).status).toBe(503);
    expect((await ASK(request(question()))).status).toBe(503);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("never enables a mock in production, even when explicitly requested without a key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOCK_VERIFIER", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await CONFIG().json()).toMatchObject({
      available: false,
      mock: false,
    });
    for (const response of [
      await POST(request(payload())),
      await ASK(request(question())),
    ]) {
      expect(response.status).toBe(503);
      expect(await response.json()).not.toHaveProperty("verdict");
    }
    expect(generateText).not.toHaveBeenCalled();
  });
  it("uses the real provider in production despite a stale mock flag", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOCK_VERIFIER", "true");
    expect(await CONFIG().json()).toMatchObject({
      available: true,
      mock: false,
      provider: "openai",
    });
    expect(await (await POST(request(payload()))).json()).toMatchObject({
      model: "gpt-6-luna",
      mock: false,
    });
    expect(generateText).toHaveBeenCalledTimes(1);
  });
  it("allows only explicit development simulation and labels it without claiming image assessment", async () => {
    vi.stubEnv("MOCK_VERIFIER", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await CONFIG().json()).toMatchObject({
      available: true,
      mock: true,
      provider: "mock",
    });
    expect(await (await POST(request(payload()))).json()).toMatchObject({
      verdict: "uncertain",
      confidence: 0,
      mock: true,
      model: "mock",
    });
    expect(
      (await POST(request({ ...payload(), frames: ["/9j/AA=="] }))).status,
    ).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("keeps both saved model-choice keys mapped to the configured OpenAI model", async () => {
    vi.stubEnv("OPENAI_VISION_MODEL", "configured-model");
    expect(await CONFIG().json()).toMatchObject({
      models: { sonnet: "configured-model", haiku: "configured-model" },
    });
    await POST(request({ ...payload(), model: "haiku" }));
    expect(generateText.mock.calls[0][0].model.modelId).toBe(
      "configured-model",
    );
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
