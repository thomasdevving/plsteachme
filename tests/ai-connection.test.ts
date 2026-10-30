import { describe, expect, it, vi } from "vitest";
import { verifyAi } from "../scripts/verify-ai";
import { visionModel, transcriptionModel } from "../lib/ai/models";

describe("AI test configuration and opt-in inference", () => {
  it("uses consistent defaults and respects explicit project models", () => {
    expect(visionModel({})).toBe("gpt-5-mini");
    expect(visionModel({ OPENAI_VISION_MODEL: " custom-model " })).toBe(
      "custom-model",
    );
    expect(transcriptionModel({})).toBe("gpt-4o-transcribe");
  });
  it("makes no request without credentials", async () => {
    const fetcher = vi.fn();
    expect((await verifyAi({}, fetcher)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("exercises the real provider adapter with image input, JSON output and response storage disabled", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "resp_test",
        object: "response",
        created_at: 0,
        status: "completed",
        model: "gpt-5-mini",
        output: [
          {
            type: "message",
            id: "msg_test",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  imageReceived: true,
                  summary: "Green and orange hands on cream.",
                }),
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 30,
          total_tokens: 130,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      }),
    );
    const result = await verifyAi(
      { OPENAI_API_KEY: "test-private-key" },
      fetcher,
    );
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "gpt-5-mini",
      store: false,
      max_output_tokens: 2000,
      text: { format: { type: "json_schema" } },
    });
    expect(
      body.input.some(
        (item: any) =>
          Array.isArray(item.content) &&
          item.content.some(
            (part: any) =>
              part.type === "input_image" &&
              part.image_url.startsWith("data:image/png;base64,"),
          ),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-private-key");
  });
  it("redacts provider errors and makes no automatic retries", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: { message: "secret-response-canary", code: "invalid_api_key" },
        },
        { status: 401 },
      ),
    );
    const result = await verifyAi({ OPENAI_API_KEY: "key-canary" }, fetcher);
    expect(result.ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(
      /key-canary|secret-response-canary/,
    );
  });
});
