import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { brandedEmailSender } from './email-sender';

export type WaitlistMailEntry={id:string;email:string;session_hash:string};
const purpose='plsteach.me:waitlist-unsubscribe:v1:';
const tokenPattern=/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/;
export function unsubscribeId(value:string):string|null {return tokenPattern.exec(value)?.[1]??null;}
function signature(entry:Pick<WaitlistMailEntry,'id'|'session_hash'>) {
  if(!/^[a-f0-9]{64}$/.test(entry.session_hash))throw new Error('Invalid waitlist key');
  // Purpose-separated proof from the row's private random session hash. The
  // email never contains the session cookie or its database hash.
  return createHmac('sha256',Buffer.from(entry.session_hash,'hex')).update(purpose+entry.id).digest();
}
export function unsubscribeToken(entry:Pick<WaitlistMailEntry,'id'|'session_hash'>) {return `${entry.id}.${signature(entry).toString('base64url')}`;}
export function validUnsubscribeToken(value:string,entry:Pick<WaitlistMailEntry,'id'|'session_hash'>) {
  const match=tokenPattern.exec(value);if(!match || match[1]!==entry.id)return false;
  const actual=Buffer.from(match[2],'base64url');if(actual.toString('base64url')!==match[2])return false;
  const expected=signature(entry);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export function waitlistSender() {return brandedEmailSender(process.env.CONFIRMATION_EMAIL_FROM?.trim()||'contact@plsteach.me');}
export function confirmationMessage(entry:WaitlistMailEntry) {
  const origin='https://plsteach.me';
  const proof=unsubscribeToken(entry);
  const removeUrl=`${origin}/unsubscribe#token=${proof}`;
  const oneClickUrl=`${origin}/api/waitlist/unsubscribe?token=${proof}`;
  const text=`You’re on the plsteach.me waitlist.\n\nThanks for your interest. We’ll email you when testing access opens. Joining the waitlist does not create an account or start a paid subscription.\n\nDidn’t sign up, or changed your mind? Remove your email from the waitlist:\n${removeUrl}\n\nYou can unsubscribe at any time.\n\nplsteach.me`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#faf7f2;color:#22372c;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto"><tr><td><a href="${origin}" style="color:#22372c;text-decoration:none;font-size:25px;font-weight:bold"><img src="${origin}/brand/hands-filled.png" width="42" height="42" alt="" style="vertical-align:middle;border:0;margin-right:8px">plsteach<span style="color:#bb4827">.me</span></a></td></tr><tr><td style="padding-top:32px"><h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.2;font-weight:normal;margin:0 0 20px">You’re on the list.</h1><p style="font-size:16px;line-height:1.7;margin:0 0 16px">Thanks for your interest in plsteach.me. We’ll email you when testing access opens.</p><p style="font-size:15px;line-height:1.7;margin:0 0 28px">Joining the waitlist does not create an account or start a paid subscription.</p><p style="font-size:15px;line-height:1.7;margin:0 0 16px"><strong>Didn’t sign up, or changed your mind?</strong><br>You can remove your email from the waitlist below.</p><a href="${removeUrl}" style="display:inline-block;background:#bb4827;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:7px;font-size:15px;font-weight:bold">Remove me from the waitlist</a><p style="font-size:13px;line-height:1.7;color:#5e685e;margin:24px 0 0">No action is needed if you want to stay on the list. You can <a href="${removeUrl}" style="color:#22372c;text-decoration:underline">unsubscribe</a> at any time.</p></td></tr></table></td></tr></table></body></html>`;
  return {subject:'You’re on the list · plsteach.me',text,html,headers:{'List-Unsubscribe':`<${oneClickUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
export async function sendWaitlistConfirmation(entry:WaitlistMailEntry,fetcher:typeof fetch=fetch):Promise<boolean> {
  const key=process.env.RESEND_API_KEY?.trim();const from=waitlistSender();
  if(!key || !from || process.env.ENABLE_CONFIRMATION_EMAIL?.trim().toLowerCase()==='false') {
    console.error(JSON.stringify({event:'waitlist.mail_failed',reason:'configuration'}));return false;
  }
  const message=confirmationMessage(entry);
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const response=await fetcher('https://api.resend.com/emails',{
        method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`waitlist-confirmation-v1/${entry.id}`},
        body:JSON.stringify({from,to:[entry.email],reply_to:'contact@plsteach.me',...message}),signal:AbortSignal.timeout(8000)
      });
      if(response.ok) {
        const result=await response.json();if(typeof result.id==='string' && result.id.length>0)return true;
      } else if(response.status<500 && response.status!==429) {
        console.error(JSON.stringify({event:'waitlist.mail_failed',reason:'provider',status:response.status}));return false;
      }
    } catch { /* A transient failure retries the same provider idempotency key. */ }
  }
  console.error(JSON.stringify({event:'waitlist.mail_failed',reason:'delivery'}));return false;
}
