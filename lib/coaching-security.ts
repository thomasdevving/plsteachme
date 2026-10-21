import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from './request-origin';
import { clientIp } from './client-ip';

export const COACH_COOKIE = 'pt-coach';
export const SESSION_SECONDS = 30 * 60;
export function coachingConfigured() { return Boolean(process.env.OPENAI_API_KEY?.trim()); }
export function coachJson(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control':'no-store, max-age=0', 'X-Content-Type-Options':'nosniff', ...extra } });
}
export function sameOrigin(request: NextRequest) {
  return isSameOrigin(request);
}
function signature(value: string) {
  const secret = process.env.COACHING_SESSION_SECRET || process.env.OPENAI_API_KEY;
  if (!secret) throw new Error('Coaching not configured');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function createCoachSession(now = Date.now()) {
  const value = `${randomBytes(18).toString('base64url')}.${now+SESSION_SECONDS*1000}`;
  return `${value}.${signature(value)}`;
}
export function validCoachSession(value: string | undefined, now = Date.now()) {
  if (!value || value.length > 180 || !coachingConfigured()) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]{24}$/.test(parts[0]) || !/^\d{13}$/.test(parts[1])) return false;
  const expiry = Number(parts[1]);
  if (expiry <= now || expiry > now+SESSION_SECONDS*1000) return false;
  const expected = Buffer.from(signature(`${parts[0]}.${parts[1]}`));
  const supplied = Buffer.from(parts[2]);
  return expected.length === supplied.length && timingSafeEqual(expected,supplied);
}

const buckets = new Map<string,{count:number;until:number}>();
// Fast per-process limit. The durable limits are in the database: a capped free
// session per account and a daily AI budget (lib/ai-guard.ts).
export function coachingRateAllowed(request: NextRequest, kind: 'session' | 'check' | 'question' | 'report' | 'voice', now = Date.now()) {
  for (const [key,bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const ip = clientIp(request);
  const key = `${kind}:${createHash('sha256').update(ip).digest('hex')}`;
  const bucket = buckets.get(key);
  const limit = {session:30,check:120,question:30,report:10,voice:20}[kind];
  if (!bucket) { if (buckets.size >= 10000) buckets.delete(buckets.keys().next().value!); buckets.set(key,{count:1,until:now+600000}); return true; }
  if (bucket.count >= limit) return false;
  bucket.count++; return true;
}

// Read incrementally: a missing or dishonest Content-Length cannot bypass the cap.
export async function limitedJson(request: Request, limit: number): Promise<{data:unknown} | {error:'size'|'validation'}> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return {error:'validation'};
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length)>limit)) return {error:'size'};
  const reader = request.body?.getReader();
  if (!reader) return {error:'validation'};
  const chunks: Uint8Array[] = [];
  let size = 0;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
  const cancel = () => { void reader.cancel().catch(() => {}); };
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => { cancel(); reject(new Error('Request interrupted')); };
    signal.addEventListener('abort', onAbort, {once:true});
  });
  try {
    if (signal.aborted) { cancel(); return {error:'validation'}; }
    while (true) {
      const next = await Promise.race([reader.read(), aborted]);
      if (next.done) break;
      size += next.value.byteLength;
      if (size>limit) { cancel(); return {error:'size'}; }
      chunks.push(next.value);
    }
    return {data:JSON.parse(Buffer.concat(chunks).toString('utf8'))};
  } catch { return {error:'validation'}; }
  finally { signal.removeEventListener('abort', onAbort); reader.releaseLock(); }
}
