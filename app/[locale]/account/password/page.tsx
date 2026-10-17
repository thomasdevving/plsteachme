import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { authenticatedUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};
export default async function AccountPassword() {
  const user = await authenticatedUser();
  if (!user || user.is_anonymous) redirect("/forgot-password");
  return (
    <AuthShell>
      <PasswordForm enabled update />
    </AuthShell>
  );
}
