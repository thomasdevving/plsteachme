import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/, "Use 3–24 letters, numbers or underscores.");
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Enter a valid name.",
  );
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
export const profileSchema = z
  .object({
    username: usernameSchema,
    firstName: nameSchema,
    lastName: nameSchema,
  })
  .strict();
export type AccountProfile = {
  username: string | null;
  firstName: string;
  lastName: string;
  hasAvatar: boolean;
  updatedAt: string;
};
export const AVATAR_BUCKET = "profile-avatars";
export const MAX_AVATAR_BYTES = 262_144;
