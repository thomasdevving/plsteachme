/** Use the same explicit model selection in coaching, drafting and setup checks. */
export const DEFAULT_VISION_MODEL = "gpt-5-mini";
export const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
type Environment = Record<string, string | undefined>;
export const visionModel = (env: Environment = process.env) =>
  env.OPENAI_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
export const transcriptionModel = (env: Environment = process.env) =>
  env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
