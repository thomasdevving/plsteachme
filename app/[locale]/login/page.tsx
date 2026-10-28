import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { authConfig } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/redirect";
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
  const { enabled, google, apple, captchaSiteKey } = authConfig();
  return (
    <AuthShell>
      <AuthForm
        enabled={enabled}
        google={google}
        apple={apple}
        captchaSiteKey={captchaSiteKey}
        next={safeNext(query.next || '/learn')}
        invalidLink={Boolean(query.error)}
      />
    </AuthShell>
  );
}
