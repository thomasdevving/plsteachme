import { NextRequest, NextResponse } from 'next/server';
import { waitlistSchema } from '@/lib/validation';
import { parse, failure, cookieOptions } from '@/lib/http';
import { db, mockMode, record, token, hash, under16Count } from '@/lib/storage';
import { BRAND } from '@/lib/config';
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
    const { data: inserted, error } = await db().from('waitlist').insert({ email: data.email, age_bracket: data.age, skills: [...new Set(data.skills)], other_skill: data.skills.includes('other') ? data.other : '', payment: data.payment || null, consent: true, consent_version: '2026-10-13', attribution: data.attribution, referral_code: referral, session_hash: hash(secret) }).select('id').single();
    // An existing address gets the same general acknowledgement, never access to its record.
    if (error?.code === '23505') return NextResponse.json({ accepted: true });
    if (error || !inserted) throw new Error('Insert failed');
    const voter = req.cookies.get('pt-voter')?.value;
    if (voter) await db().from('skill_votes').update({ waitlist_id: inserted.id }).eq('voter_hash', hash(voter));
    if (process.env.ENABLE_CONFIRMATION_EMAIL === 'true' && process.env.RESEND_API_KEY && process.env.CONFIRMATION_EMAIL_FROM) {
      try {
        await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.CONFIRMATION_EMAIL_FROM, to: [data.email], subject: `You’re on the list · ${BRAND}`, text: 'Thank you! We’ll keep you posted. Reply to this email to unsubscribe.' }) });
      } catch { console.error('Confirmation email unavailable; signup saved.'); }
    }
    const response = NextResponse.json({ accepted: true });
    response.cookies.set('pt-signup', secret, cookieOptions);
    return response;
  } catch { return failure(); }
}
