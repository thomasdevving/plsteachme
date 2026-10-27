import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/components/password-form";
import { authConfig } from "@/lib/auth/config";
export const metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
};
export default function ResetPassword() {
  return (
    <AuthShell>
      <PasswordForm enabled={authConfig().enabled} reset />
    </AuthShell>
  );
}
