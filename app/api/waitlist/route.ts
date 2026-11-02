import { NextRequest, NextResponse } from 'next/server';
import { waitlistSchema } from '@/lib/validation';
import { parse, failure, cookieOptions } from '@/lib/http';
import { db, mockMode, record, token, hash, under16Count } from '@/lib/storage';
import { sendWaitlistConfirmation } from '@/lib/waitlist-mail';
// Only an aggregate is public. Email addresses and individual records stay private.
export async function GET() {
  if(mockMode)return NextResponse.json({count:null},{status:503,headers:{'Cache-Control':'no-store'}});
  try {
    const {count,error}=await db().from('waitlist').select('id',{count:'exact',head:true});
    if(error || !Number.isSafeInteger(count) || (count ?? -1)<0)throw new Error('count');
    return NextResponse.json({count},{headers:{'Cache-Control':'public, max-age=30, s-maxage=60'}});
  } catch {return NextResponse.json({count:null},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(req: NextRequest) {
  const parsed = await parse(req, waitlistSchema);
  if ('response' in parsed) return parsed.response;
  const data = parsed.data;
  if (data.website) return NextResponse.json({ accepted: true });
  try {
    if (data.age === 'under16') {
      await under16Count();
      const response = NextResponse.json({ under16: true });
      response.cookies.delete('pt-signup'); response.cookies.delete('pt-voter');
      return response;
    }
    if (mockMode) { await record('waitlist', {}); return NextResponse.json({ mock: true }); }
    const secret = token();
    const referral = token().slice(0,12);
    const { data: inserted, error } = await db().from('waitlist').insert({ email: data.email, age_bracket: data.age, skills: [...new Set(data.skills)], other_skill: data.skills.includes('other') ? data.other : '', payment: data.payment || null, consent: true, consent_version: '2026-10-13', attribution: data.attribution, referral_code: referral, session_hash: hash(secret) }).select('id,email,session_hash').single();
    // A repeat request can retry its own confirmation, but never receives the
    // existing record's session cookie or any of its private data.
    let entry=inserted;
    if(error?.code==='23505') {
      const existing=await db().from('waitlist').select('id,email,session_hash').eq('email',data.email).maybeSingle();
      if(existing.error || !existing.data)throw new Error('Waitlist unavailable');
      entry=existing.data;
    } else if(error || !entry)throw new Error('Insert failed');
    if(!entry)throw new Error('Waitlist unavailable');
    if(!error) {
      const voter=req.cookies.get('pt-voter')?.value;
      if(voter)await db().from('skill_votes').update({waitlist_id:entry.id}).eq('voter_hash',hash(voter));
    }
    const sent=await sendWaitlistConfirmation(entry);
    if(!sent) {
      const response=NextResponse.json({error:'email',saved:true},{status:503});
      if(!error)response.cookies.set('pt-signup',secret,cookieOptions);
      return response;
    }
    const response = NextResponse.json({ accepted: true });
    if(!error)response.cookies.set('pt-signup',secret,cookieOptions);
    return response;
  } catch { return failure(); }
}
