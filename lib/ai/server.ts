import "server-only";
import { visionModel } from './models';
import { createOpenAI } from "@ai-sdk/openai";
import { limitedJson } from "../coaching-security";
import { normalizeFrame } from "../vision/frames";
import { isSameOrigin } from '../request-origin';
export const isMock = () =>
  process.env.MOCK_VERIFIER === "true" && process.env.NODE_ENV !== "production";
export const isAvailable = () =>
  isMock() || Boolean(process.env.OPENAI_API_KEY?.trim());
// Keep saved client model choices readable while using the configured provider.
export function modelName(_choice?: "sonnet" | "haiku") {
  return visionModel();
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
  // Bound dimensions and remove all metadata before forwarding.
  return normalizeFrame(bytes);
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
  if (origin && !isSameOrigin(request))
    throw new Error("origin");
  const body = await limitedJson(request, limit);
  if ('error' in body) throw new Error(body.error);
  return body.data;
}
