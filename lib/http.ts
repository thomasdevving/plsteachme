import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allow } from './rate-limit';
import { hash } from './storage';
import { SITE_URL } from './config';
export async function parse<T>(request: NextRequest, schema: z.ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  const origin = request.headers.get('origin');
  const hostOrigin = `${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`;
  if (origin && ![request.nextUrl.origin, hostOrigin, SITE_URL].includes(origin)) return { response: NextResponse.json({ error: 'origin' }, { status: 403 }) };
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!allow(hash(ip))) return { response: NextResponse.json({ error: 'rate' }, { status: 429, headers: { 'Retry-After': '600' } }) };
  if (Number(request.headers.get('content-length') || 0) > 16384) return { response: NextResponse.json({ error: 'size' }, { status: 413 }) };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384) return { response: NextResponse.json({ error: 'size' }, { status: 413 }) };
    const data = schema.safeParse(JSON.parse(raw));
    if (!data.success) return { response: NextResponse.json({ error: 'validation' }, { status: 400 }) };
    return { data: data.data };
  } catch { return { response: NextResponse.json({ error: 'validation' }, { status: 400 }) }; }
}
export function failure() { return NextResponse.json({ error: 'storage' }, { status: 503 }); }
export const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 };
