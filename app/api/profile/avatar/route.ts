import { AVATAR_BUCKET, MAX_AVATAR_BYTES } from "@/lib/auth/profile";
import {
  profileUser,
  saveAvatar,
  removeAvatar,
  profileFailure,
  ProfileError,
} from "@/lib/auth/profiles-server";
import { sameOrigin } from "@/lib/auth/redirect";
import { db } from "@/lib/storage";
import { sharedRateAllowed } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET() {
  try {
    const user = await profileUser();
    const { data, error } = await db()
      .storage.from(AVATAR_BUCKET)
      .download(`${user.id}/avatar.jpg`);
    if (error || !data) return new Response(null, { status: 404, headers });
    return new Response(data, {
      headers: { ...headers, "Content-Type": "image/jpeg" },
    });
  } catch (error) {
    return profileFailure(error);
  }
}
async function mutate(request: Request, remove: boolean) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Please use your account page." },
      { status: 403, headers },
    );
  try {
    const user = await profileUser();
    if (!(await sharedRateAllowed(`avatar:${user.id}`, 20, 3600)))
      throw new ProfileError(
        429,
        "Please wait before changing your photo again.",
      );
    if (remove) return Response.json(await removeAvatar(user.id), { headers });
    if (request.headers.get("content-type") !== "image/jpeg")
      throw new ProfileError(400, "Please choose a valid photo.");
    const reader = request.body?.getReader();
    if (!reader) throw new ProfileError(400, "Please choose a photo.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_AVATAR_BYTES)
          throw new ProfileError(413, "Your photo is too large.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => null);
    }
    return Response.json(await saveAvatar(user.id, Buffer.concat(chunks)), {
      headers,
    });
  } catch (error) {
    return profileFailure(error);
  }
}
export const POST = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);
