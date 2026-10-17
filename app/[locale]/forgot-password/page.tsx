import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { authConfig } from "@/lib/auth/config";
export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};
export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <AuthShell>
      <PasswordForm
        enabled={authConfig().enabled}
        invalidLink={Boolean(query.error)}
      />
    </AuthShell>
  );
}
