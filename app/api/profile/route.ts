import { profileSchema } from "@/lib/auth/profile";
import {
  profileUser,
  readProfile,
  saveProfile,
  profileFailure,
} from "@/lib/auth/profiles-server";
import { sameOrigin } from "@/lib/auth/redirect";
import { limitedJson } from "@/lib/coaching-security";
import { sharedRateAllowed } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const user = await profileUser();
    return Response.json({ profile: await readProfile(user.id) }, { headers });
  } catch (error) {
    return profileFailure(error);
  }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Please use your account page." },
      { status: 403, headers },
    );
  try {
    const user = await profileUser();
    if (!(await sharedRateAllowed(`profile:${user.id}`, 30, 3600)))
      return Response.json(
        { error: "Please wait before changing your profile again." },
        { status: 429, headers },
      );
    const body = await limitedJson(request, 1500);
    const parsed = profileSchema.safeParse("data" in body ? body.data : null);
    if (!parsed.success)
      return Response.json(
        {
          error:
            "Enter your first name, last name, and a username of 3–24 letters, numbers or underscores.",
        },
        { status: 400, headers },
      );
    return Response.json(await saveProfile(user.id, parsed.data), { headers });
  } catch (error) {
    return profileFailure(error);
  }
}
