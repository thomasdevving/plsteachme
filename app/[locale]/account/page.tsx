import { AuthShell } from "@/components/auth-shell";
import { AccountPanel } from "@/components/account-panel";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default function Account() {
  return (
    <AuthShell>
      <AccountPanel />
    </AuthShell>
  );
}
