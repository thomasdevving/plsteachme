import { NextRequest, NextResponse } from 'next/server';
import { followupSchema } from '@/lib/validation';
import { parse, failure } from '@/lib/http';
import { db, hash, mockMode } from '@/lib/storage';
export async function POST(req: NextRequest) {
  const parsed = await parse(req, followupSchema);
  if ('response' in parsed) return parsed.response;
  if (parsed.data.website) return NextResponse.json({ accepted: true });
  if (mockMode) return NextResponse.json({ mock: true });
  const secret = req.cookies.get('pt-signup')?.value;
  if (!secret) return NextResponse.json({ error: 'session' }, { status: 401 });
  try {
    const { data } = await db().from('waitlist').select('id').eq('session_hash', hash(secret)).maybeSingle();
    if (!data) return NextResponse.json({ error: 'session' }, { status: 401 });
    const { error } = await db().from('followups').upsert({ waitlist_id: data.id, answer: parsed.data.answer }, { onConflict: 'waitlist_id' });
    if (error) throw error;
    return NextResponse.json({ accepted: true });
  } catch { return failure(); }
}
