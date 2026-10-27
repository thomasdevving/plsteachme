import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { authConfig } from "@/lib/auth/config";
export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};
export default function ForgotPassword() {
  const { enabled, captchaSiteKey } = authConfig();
  return (
    <AuthShell>
      <PasswordForm enabled={enabled} captchaSiteKey={captchaSiteKey} />
    </AuthShell>
  );
}
