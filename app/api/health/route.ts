import { coachingConfigured } from '@/lib/coaching-security';
import { platformConfigured, platformDb } from '@/lib/platform-server';
import { logError } from '@/lib/log';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Uptime check for an external monitor: 200 when the database answers and AI is configured.
// Reports only booleans, never configuration values.
export async function GET() {
  const ai = coachingConfigured();
  let database = false;
  if (platformConfigured()) {
    try {
      const { error } = await platformDb().from('ai_usage').select('day', { head: true, count: 'exact' }).limit(1);
      database = !error;
      if (error) logError('health.database', {}, error);
    } catch (error) { logError('health.database', {}, error); }
  }
  const ok = ai && database;
  return Response.json({ ok, database, ai }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
