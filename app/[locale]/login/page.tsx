import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authConfig } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/redirect";
import { authenticatedUser } from "@/lib/auth/server";
import { authProviders } from "@/lib/auth/providers";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  if (await authenticatedUser()) redirect(safeNext(query.next));
  const { enabled } = authConfig();
  const { google, apple } = await authProviders();
  return (
    <AuthShell>
      <AuthForm
        enabled={enabled}
        google={google}
        apple={apple}
        next={safeNext(query.next)}
        invalidLink={Boolean(query.error)}
      />
    </AuthShell>
  );
}
