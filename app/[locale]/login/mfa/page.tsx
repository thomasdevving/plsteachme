import { AuthShell } from '@/components/auth-shell';
import { MfaChallenge } from '@/components/mfa';
import { safeNext } from '@/lib/auth/redirect';
export const metadata = { title: 'Verify your authenticator', robots: { index: false, follow: false } };
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  return <AuthShell><MfaChallenge next={safeNext(query.next || '/learn')} /></AuthShell>;
}
