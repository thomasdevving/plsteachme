import { isAvailable, isMock, json, modelName } from "@/lib/ai/server";
export function GET() {
  return json({
    mock: isMock(),
    available: isAvailable(),
    provider: isMock() ? "mock" : "openai",
    models: { sonnet: modelName("sonnet"), haiku: modelName("haiku") },
  });
}
