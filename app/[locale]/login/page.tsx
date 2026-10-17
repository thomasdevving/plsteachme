import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authConfig } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/redirect";
import { authenticatedUser } from "@/lib/auth/server";
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
  return (
    <AuthShell>
      <AuthForm
        enabled={enabled}
        next={safeNext(query.next)}
        invalidLink={Boolean(query.error)}
      />
    </AuthShell>
  );
}
