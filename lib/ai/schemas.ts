import { z } from "zod";
import { verificationResultSchema } from "../session/decision";
export const modelChoiceSchema = z.enum(["sonnet", "haiku"]);
const intake = z
  .record(z.string().max(80), z.string().max(200))
  .refine((v) => Object.keys(v).length <= 20);
const base = {
  skillId: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  stepId: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  intake,
  model: modelChoiceSchema.optional(),
};
export const verifyInputSchema = z.object({
  ...base,
  attemptNumber: z.number().int().min(1).max(1000),
  previousFeedback: z.string().max(500).optional(),
  frames: z
    .array(
      z
        .string()
        .max(400000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/)
        .refine(
          (s) =>
            s.length % 4 === 0 &&
            s.startsWith("/9j/") &&
            (s.length * 3) / 4 -
              (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0) <
              300000,
          "Expected a JPEG smaller than 300 KB",
        ),
    )
    .min(1)
    .max(3),
});
export const askInputSchema = z.object({
  ...base,
  question: z.string().trim().min(1).max(500),
});
export const verificationResponseSchema = verificationResultSchema.extend({
  latencyMs: z.number().nonnegative(),
  model: z.string(),
  mock: z.boolean(),
});
export type VerificationResponse = z.infer<typeof verificationResponseSchema>;
export const askResponseSchema = z.object({
  answer: z.string().min(1).max(1200),
  mock: z.boolean(),
});
