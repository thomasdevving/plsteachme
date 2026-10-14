import { isMock, json, modelName } from "@/lib/ai/server";
export function GET() {
  return json({
    mock: isMock(),
    models: { sonnet: modelName("sonnet"), haiku: modelName("haiku") },
  });
}
