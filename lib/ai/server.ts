import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { prepareCameraFrame } from '../camera-processor';
import { limitedJson } from "../coaching-security";
import { isSameOrigin } from '../request-origin';
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
  return prepareCameraFrame(encoded, 300_000);
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
