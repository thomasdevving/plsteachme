import { z } from 'zod';
import { authClient } from '@/lib/auth/server';
import { needsMfa } from '@/lib/auth/mfa';
import { safeNext, sameOrigin } from '@/lib/auth/redirect';
import { limitedJson } from '@/lib/coaching-security';
import { db, hash } from '@/lib/storage';
import { clientIp } from '@/lib/client-ip';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enroll') }).strict(),
  z.object({ action: z.literal('verify'), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/), next: z.string().max(2000).optional() }).strict(),
  z.object({ action: z.literal('remove'), factorId: z.uuid() }).strict(),
]);
export async function GET() {
  try {
    const client = await authClient();
    if (!client) return reply({ error: 'Account security is temporarily unavailable.' }, 503);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous) return reply({ error: 'Sign in to continue.' }, 401);
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return reply({ error: 'Account security could not load.' }, 503);
    return reply({ required: await needsMfa(client, user), factors: factors.data.totp.map(factor => ({ id: factor.id, name: factor.friendly_name || 'Authenticator app' })) });
  } catch { return reply({ error: 'Account security could not load. Please try again.' }, 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Open this form on plsteach.me.' }, 403);
  const body = await limitedJson(request, 4000);
  if ('error' in body) return reply({ error: 'Invalid security request.' }, 400);
  const parsed = actionSchema.safeParse(body.data);
  if (!parsed.success) return reply({ error: 'Enter the six-digit code from your authenticator app.' }, 400);
  try {
    const client = await authClient();
    if (!client) return reply({ error: 'Account security is temporarily unavailable.' }, 503);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous) return reply({ error: 'Sign in to continue.' }, 401);
    // Durable limits fail closed. Never log OTPs, enrollment keys or QR codes.
    for (const key of [`mfa-user:${user.id}`, `mfa-ip:${hash(clientIp(request))}`]) {
      const result = await db().rpc('rate_hit', { p_key: key, p_max: 12, p_window_seconds: 900 });
      if (result.error) return reply({ error: 'Account security is temporarily unavailable.' }, 503);
      if (result.data !== true) return reply({ error: 'Too many attempts. Please wait 15 minutes.' }, 429);
    }
    const action = parsed.data;
    const required = await needsMfa(client, user);
    if (required && action.action !== 'verify') return reply({ error: 'Verify your authenticator before changing security settings.' }, 403);
    const listed = await client.auth.mfa.listFactors();
    if (listed.error) return reply({ error: 'Account security could not load.' }, 503);
    if (action.action === 'enroll') {
      if (listed.data.totp.length) return reply({ error: 'An authenticator is already enabled.' }, 409);
      // Clear abandoned setups owned by this account so retrying cannot exhaust the factor limit.
      for (const factor of listed.data.all.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified')) {
        const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) return reply({ error: 'The previous setup could not be cleared. Please try again.' }, 503);
      }
      const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'plsteach.me authenticator', issuer: 'plsteach.me' });
      if (result.error) return reply({ error: 'Authenticator setup is unavailable. Please try again later.' }, 503);
      return reply({ enrollment: { id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret } });
    }
    const factor = listed.data.all.find(item => item.id === action.factorId && item.factor_type === 'totp');
    if (!factor || (required && factor.status !== 'verified')) return reply({ error: 'Choose your registered authenticator.' }, 400);
    if (action.action === 'remove') {
      const result = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (result.error) return reply({ error: 'The authenticator could not be removed. Please try again.' }, 400);
      return reply({ ok: true });
    }
    const result = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: action.code });
    if (result.error) return reply({ error: 'That code did not work. Enter a fresh code from your authenticator.' }, 400);
    return reply({ ok: true, url: safeNext(action.next || '/account') });
  } catch { return reply({ error: 'Account security is temporarily unavailable. Please try again.' }, 503); }
}
