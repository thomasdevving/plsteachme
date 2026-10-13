import Anthropic from "@anthropic-ai/sdk";
export const isMock = () =>
  process.env.MOCK_VERIFIER === "true" || !process.env.ANTHROPIC_API_KEY;
export function modelName(choice?: "sonnet" | "haiku") {
  return choice === "haiku"
    ? process.env.FAST_VERIFIER_MODEL || "claude-haiku-5-5"
    : process.env.VERIFIER_MODEL || "claude-sonnet-5-5";
}
export const client = () =>
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 0,
    timeout: 7000,
  });
export function parseJSON(text: string): unknown {
  return JSON.parse(
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
  );
}
export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
// Read with a byte limit, including chunked requests. Never echo invalid payloads.
export async function readJSON(request: Request, limit = 1250000) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Error("origin");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("content-type");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("size");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
