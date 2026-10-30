import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { visionModel } from "../lib/ai/models";
import { fetchWithTimeout } from "../lib/network";
import type { SetupCheck } from "./verify-setup";

/** One bounded inference on a public icon, never camera frames or account data. */
export async function verifyAi(
  env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetchWithTimeout,
): Promise<SetupCheck> {
  const name = "OpenAI image and structured response";
  if (!env.OPENAI_API_KEY?.trim())
    return {
      name,
      ok: false,
      detail:
        "Set OPENAI_API_KEY securely in .env.local before running this local check.",
    };
  try {
    const image = await readFile(
      new URL("../public/icons/icon-192.png", import.meta.url),
    );
    const provider = createOpenAI({
      apiKey: env.OPENAI_API_KEY.trim(),
      fetch: fetcher,
    });
    const result = await generateText({
      model: provider.responses(visionModel(env)),
      system:
        "This is a connectivity test using the public plsteach.me brand icon, not a coaching assessment. Confirm that you received an image and briefly describe its colors. Return only the requested structured output.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe the colors in this public illustration.",
            },
            { type: "image", image, mediaType: "image/png" },
          ],
        },
      ],
      output: Output.object({
        schema: z.object({
          imageReceived: z.literal(true),
          summary: z.string().min(1).max(200),
        }),
      }),
      providerOptions: {
        openai: {
          store: false,
          reasoningEffort: "low",
          reasoningSummary: null,
        },
      },
      maxOutputTokens: 2000,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30_000),
    });
    if (result.output?.imageReceived !== true)
      throw new Error("No valid response");
    return {
      name,
      ok: true,
      detail:
        "One image request returned valid structured output. This does not validate coaching quality or the deployed trial flow.",
    };
  } catch {
    return {
      name,
      ok: false,
      detail:
        "The image request failed. Check the configured model, project billing, API permissions and network access. Provider output and credentials are not printed.",
    };
  }
}

async function main() {
  if (process.argv.slice(2).join(" ") !== "--confirm-api-call") {
    console.error("Usage: npm run verify:ai -- --confirm-api-call");
    console.error(
      "This sends one public icon to OpenAI and may incur API charges. It does not create an account, use a learner trial, or change the database.",
    );
    process.exitCode = 1;
    return;
  }
  nextEnv.loadEnvConfig(process.cwd(), false, {
    info: () => {},
    error: () => {},
  });
  const check = await verifyAi(process.env);
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  process.exitCode = check.ok ? 0 : 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  void main().catch(() => {
    console.error(
      "AI verification could not complete. No credentials or provider response were printed.",
    );
    process.exitCode = 1;
  });
