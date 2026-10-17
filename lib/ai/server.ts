import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import sharp from "sharp";
export const isMock = () =>
  process.env.MOCK_VERIFIER === "true" && process.env.NODE_ENV !== "production";
export const isAvailable = () =>
  isMock() || Boolean(process.env.OPENAI_API_KEY?.trim());
// Keep saved client model choices readable while using the configured provider.
export function modelName(_choice?: "sonnet" | "haiku") {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-6-luna";
}
export const client = () =>
  createOpenAI({ apiKey: process.env.OPENAI_API_KEY?.trim() });
export function providerSignal(request: Request) {
  return AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
}
export async function decodeFrame(encoded: string): Promise<Buffer> {
  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.length > 300_000 ||
    bytes.toString("base64") !== encoded ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  )
    throw new Error("Invalid frame");
  // Decode the full JPEG, bound memory, orient it and remove all metadata.
  return sharp(bytes, { limitInputPixels: 1_048_576, failOn: "warning" })
    .rotate()
    .resize(640, 640, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 65 })
    .toBuffer();
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
