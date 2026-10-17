import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authConfig } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/redirect";
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
  const { enabled, google, apple } = authConfig();
  return (
    <AuthShell>
      <AuthForm
        signup
        enabled={enabled}
        google={google}
        apple={apple}
        next={safeNext(query.next)}
      />
    </AuthShell>
  );
}
