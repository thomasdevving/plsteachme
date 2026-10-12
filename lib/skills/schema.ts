import { z } from "zod";

export const precheckNameSchema = z.enum([
  "bothShouldersVisible",
  "neckRegionVisible",
  "bothHandsVisible",
  "handsInChestRegion",
  "enoughLight",
]);
export const stepSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    instruction: z.string().min(1),
    spokenInstruction: z.string().min(1),
    demoAsset: z.string().startsWith("/skills/"),
    checkStrictness: z.enum(["strict", "light", "none"]),
    localPrechecks: z.array(precheckNameSchema),
    rubric: z.object({
      passCriteria: z.array(z.string().min(1)).min(1),
      commonErrors: z.array(
        z.object({
          id: z.string().min(1),
          description: z.string().min(1),
          cue: z.string().min(1),
        }),
      ),
      notVisibleCue: z.string().min(1),
    }),
    maxAttempts: z.number().int().min(1).max(10),
  })
  .superRefine((step, ctx) => {
    const ids = step.rubric.commonErrors.map((error) => error.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Common error IDs must be unique.",
      });
  });
const base = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
};
export const availableSkillSchema = z
  .object({
    ...base,
    status: z.literal("available"),
    estimatedMinutes: z.number().positive(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    equipment: z.array(z.string().min(1)).min(1),
    intake: z.array(
      z.object({
        id: z.string().min(1),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(2),
      }),
    ),
    cameraSetup: z.object({
      instruction: z.string().min(1),
      requiredLandmarks: z.array(
        z.enum([
          "leftShoulder",
          "rightShoulder",
          "nose",
          "leftHand",
          "rightHand",
        ]),
      ),
      minLuminance: z.number().min(0).max(255),
    }),
    steps: z.array(stepSchema).min(1),
    completion: z.object({
      message: z.string().min(1),
      tips: z.array(z.string().min(1)),
    }),
  })
  .superRefine((skill, ctx) => {
    for (const [label, ids] of [
      ["Step", skill.steps.map((step) => step.id)],
      ["Intake", skill.intake.map((question) => question.id)],
    ] as const) {
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          message: `${label} IDs must be unique.`,
        });
    }
  });
export const skillSchema = z.discriminatedUnion("status", [
  availableSkillSchema,
  z.object({
    ...base,
    status: z.literal("coming_soon"),
    steps: z.array(stepSchema).length(0),
  }),
]);
export type Skill = z.infer<typeof skillSchema>;
export type AvailableSkill = z.infer<typeof availableSkillSchema>;
export type SkillStep = z.infer<typeof stepSchema>;
export type IntakeAnswers = Record<string, string>;
