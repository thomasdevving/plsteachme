import { NextRequest, NextResponse } from 'next/server';
import { orgSchema } from '@/lib/validation';
import { parse, failure } from '@/lib/http';
import { mockMode, record } from '@/lib/storage';
export async function POST(req: NextRequest) {
  const parsed = await parse(req, orgSchema);
  if ('response' in parsed) return parsed.response;
  const { website, ...data } = parsed.data;
  if (website) return NextResponse.json({ accepted: true });
  try { await record('org_leads', { ...data, consent_version: '2026-10-13' }); return NextResponse.json({ accepted: true, mock: mockMode }); } catch { return failure(); }
}
