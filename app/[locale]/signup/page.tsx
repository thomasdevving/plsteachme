import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authConfig } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/redirect";
import { authenticatedUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  if (await authenticatedUser()) redirect(safeNext(query.next));
  const { enabled } = authConfig();
  return (
    <AuthShell>
      <AuthForm
        signup
        enabled={enabled}
        next={safeNext(query.next)}
      />
    </AuthShell>
  );
}
