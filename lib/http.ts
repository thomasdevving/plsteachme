import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allow } from './rate-limit';
import { hash } from './storage';
import { isSameOrigin } from './request-origin';
import { limitedJson } from './coaching-security';
import { clientIp } from './client-ip';
export async function parse<T>(request: NextRequest, schema: z.ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  const origin = request.headers.get('origin');
  if (origin && !isSameOrigin(request)) return { response: NextResponse.json({ error: 'origin' }, { status: 403 }) };
  const ip = clientIp(request);
  if (!allow(hash(ip))) return { response: NextResponse.json({ error: 'rate' }, { status: 429, headers: { 'Retry-After': '600' } }) };
  try {
    const body = await limitedJson(request, 16384);
    if ('error' in body) return { response: NextResponse.json({ error: body.error }, { status: body.error === 'size' ? 413 : 400 }) };
    const data = schema.safeParse(body.data);
    if (!data.success) return { response: NextResponse.json({ error: 'validation' }, { status: 400 }) };
    return { data: data.data };
  } catch { return { response: NextResponse.json({ error: 'validation' }, { status: 400 }) }; }
}
export function failure() { return NextResponse.json({ error: 'storage' }, { status: 503 }); }
export const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 };
