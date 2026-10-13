import { NextRequest, NextResponse } from 'next/server';
import { voteSchema } from '@/lib/validation';
import { parse, failure, cookieOptions } from '@/lib/http';
import { db, hash, mockMode, record, token } from '@/lib/storage';
export async function POST(req: NextRequest) {
  const parsed = await parse(req, voteSchema);
  if ('response' in parsed) return parsed.response;
  if (parsed.data.website) return NextResponse.json({ accepted: true });
  try {
    if (mockMode) { await record('skill_votes', {}); return NextResponse.json({ mock: true }); }
    const voter = req.cookies.get('pt-voter')?.value || token();
    const secret = req.cookies.get('pt-signup')?.value;
    let waitlistId: string | null = null;
    if (secret) { const { data } = await db().from('waitlist').select('id').eq('session_hash', hash(secret)).maybeSingle(); waitlistId = data?.id || null; }
    const { error } = await db().from('skill_votes').upsert({ skill: parsed.data.skill, voter_hash: hash(voter), waitlist_id: waitlistId }, { onConflict: 'voter_hash,skill', ignoreDuplicates: true });
    if (error) throw error;
    const response = NextResponse.json({ accepted: true }); response.cookies.set('pt-voter', voter, cookieOptions); return response;
  } catch { return failure(); }
}
