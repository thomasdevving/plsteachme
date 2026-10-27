import "server-only";
import { authenticatedUser } from "./server";
import { db } from "../storage";
import { sanitizeJpeg } from "../vision/jpeg";
import {
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  type AccountProfile,
} from "./profile";

export class ProfileError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function profileUser() {
  const user = await authenticatedUser();
  if (!user || user.is_anonymous)
    throw new ProfileError(401, "Please sign in to manage your profile.");
  return user;
}
export async function readProfile(
  userId: string,
): Promise<AccountProfile | null> {
  const { data, error } = await db()
    .from("account_profiles")
    .select("username,first_name,last_name,has_avatar,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new ProfileError(
      503,
      "Your profile could not load. Please try again.",
    );
  return data
    ? {
        username: data.username,
        firstName: data.first_name,
        lastName: data.last_name,
        hasAvatar: data.has_avatar,
        updatedAt: data.updated_at,
      }
    : null;
}
export async function saveProfile(
  userId: string,
  input: { username: string; firstName: string; lastName: string },
) {
  const { error } = await db()
    .from("account_profiles")
    .upsert(
      {
        user_id: userId,
        username: input.username,
        first_name: input.firstName,
        last_name: input.lastName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error?.code === "23505")
    throw new ProfileError(
      409,
      "That username is already taken. Please choose another.",
    );
  if (error)
    throw new ProfileError(
      503,
      "Your profile could not be saved. Please try again.",
    );
  return { profile: await readProfile(userId) };
}
export async function saveAvatar(userId: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES)
    throw new ProfileError(
      413,
      "Your photo is too large. Please choose another.",
    );
  let clean: Uint8Array;
  try {
    clean = sanitizeJpeg(bytes, 512 * 512);
  } catch {
    throw new ProfileError(400, "Please choose a valid photo.");
  }
  const client = db();
  const { error } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(`${userId}/avatar.jpg`, clean, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "0",
    });
  if (error)
    throw new ProfileError(
      503,
      "Your photo could not be uploaded. Please try again.",
    );
  const saved = await client
    .from("account_profiles")
    .upsert(
      {
        user_id: userId,
        has_avatar: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (saved.error)
    throw new ProfileError(
      503,
      "Your photo uploaded, but your profile could not update. Please try again.",
    );
  return { profile: await readProfile(userId) };
}
export async function removeAvatar(userId: string) {
  const client = db();
  const { error } = await client.storage
    .from(AVATAR_BUCKET)
    .remove([`${userId}/avatar.jpg`]);
  if (error)
    throw new ProfileError(
      503,
      "Your photo could not be removed. Please try again.",
    );
  const saved = await client
    .from("account_profiles")
    .update({ has_avatar: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (saved.error)
    throw new ProfileError(
      503,
      "Your profile could not update. Please try again.",
    );
  return { profile: await readProfile(userId) };
}
export function profileFailure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof ProfileError
          ? error.message
          : "Your account could not be updated. Please try again.",
    },
    {
      status: error instanceof ProfileError ? error.status : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
