import { APP_VERSION } from '@/lib/pwa/config';
export const dynamic = 'force-dynamic';
// The deployed app version, for update notices and as a lightweight
// reachability check. Contains no configuration or user data.
export function GET() {
  return Response.json({ version: APP_VERSION }, { headers: { 'Cache-Control': 'no-store' } });
}
