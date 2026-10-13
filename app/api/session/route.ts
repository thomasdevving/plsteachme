import { NextRequest, NextResponse } from 'next/server';
import { db, hash, mockMode } from '@/lib/storage';
export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (mockMode) return NextResponse.json({ mock: true }, { headers });
  const secret = req.cookies.get('pt-signup')?.value;
  if (!secret) return NextResponse.json({ referral: null }, { headers });
  try { const { data } = await db().from('waitlist').select('referral_code').eq('session_hash', hash(secret)).maybeSingle(); return NextResponse.json({ referral: data?.referral_code || null }, { headers }); } catch { return NextResponse.json({ error: 'storage' }, { status: 503, headers }); }
}
