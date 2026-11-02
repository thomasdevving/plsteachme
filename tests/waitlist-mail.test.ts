import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { confirmationMessage, sendWaitlistConfirmation, unsubscribeToken, validUnsubscribeToken } from '../lib/waitlist-mail';
import { brandedEmailSender } from '../lib/email-sender';
const entry={id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test',session_hash:'a'.repeat(64)};
beforeEach(()=>{vi.stubEnv('RESEND_API_KEY','test-key');vi.stubEnv('ENABLE_CONFIRMATION_EMAIL','true');vi.stubEnv('CONFIRMATION_EMAIL_FROM','Personal Name <contact@plsteach.me>');});
afterEach(()=>vi.unstubAllEnvs());
describe('branded waitlist confirmation',()=>{
 it('uses a distinct removal proof that cannot act as the session cookie/hash',()=>{
  const proof=unsubscribeToken(entry);expect(proof).toHaveLength(80);expect(validUnsubscribeToken(proof,entry)).toBe(true);
  expect(proof).not.toContain(entry.session_hash);
  expect(validUnsubscribeToken(proof,{...entry,session_hash:'b'.repeat(64)})).toBe(false);
  expect(validUnsubscribeToken(proof,{...entry,id:'22222222-2222-4222-8222-222222222222'})).toBe(false);
  expect(validUnsubscribeToken(proof.slice(0,-1)+(proof.endsWith('A')?'B':'A'),entry)).toBe(false);
 });
 it('includes branding, plain text, an explicit removal link and mailbox one-click headers',()=>{
  const message=confirmationMessage(entry);
  expect(message.html).toContain('https://plsteach.me/brand/hands-filled.png');
  expect(message.text).toContain(`https://plsteach.me/unsubscribe#token=${unsubscribeToken(entry)}`);
  expect(message.html).toContain('Didn’t sign up');
  expect(message.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  expect(message.headers['List-Unsubscribe']).toContain('/api/waitlist/unsubscribe?token=');
 });
 it('forces the brand display name and rejects personal-domain senders',()=>{
  expect(brandedEmailSender('Personal Person <CONTACT@PLSTEACH.ME>')).toBe('plsteach.me <contact@plsteach.me>');
  expect(brandedEmailSender('personal@gmail.com')).toBeNull();
  expect(brandedEmailSender('person@plsteach.me.attacker.example')).toBeNull();
 });
 it('sends the same body/key on a transient retry and accepts only provider acknowledgement',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(Response.json({id:'message-id'}));
  expect(await sendWaitlistConfirmation(entry,fetcher)).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);
  const [url,options]=fetcher.mock.calls[1];expect(url).toBe('https://api.resend.com/emails');
  expect(options.headers['Idempotency-Key']).toBe(`waitlist-confirmation-v1/${entry.id}`);
  expect(options.body).toBe(fetcher.mock.calls[0][1].body);
  expect(JSON.parse(options.body)).toMatchObject({from:'plsteach.me <contact@plsteach.me>',to:[entry.email],reply_to:'contact@plsteach.me'});
 });
 it('does not mark rejection or missing configuration as sent, and logs no private data',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
   const fetcher=vi.fn().mockResolvedValue(new Response('private provider details',{status:403}));
   expect(await sendWaitlistConfirmation(entry,fetcher)).toBe(false);expect(fetcher).toHaveBeenCalledTimes(1);
   vi.stubEnv('RESEND_API_KEY','');fetcher.mockClear();
   expect(await sendWaitlistConfirmation(entry,fetcher)).toBe(false);expect(fetcher).not.toHaveBeenCalled();
   expect(JSON.stringify(log.mock.calls)).not.toContain(entry.email);expect(JSON.stringify(log.mock.calls)).not.toContain('private provider details');
  } finally {log.mockRestore();}
 });
});
