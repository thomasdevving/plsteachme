import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({mock:false,find:vi.fn(),remove:vi.fn(),deleted:vi.fn()}));
vi.mock('@/lib/storage',async()=>{const {createHash}=await import('node:crypto');return {get mockMode(){return state.mock;},hash:(value:string)=>createHash('sha256').update(value).digest('hex'),
 db:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:state.find})}),delete:()=>{state.deleted();return {eq:()=>({eq:state.remove})};}})})};});
import { GET, POST } from '../app/api/waitlist/unsubscribe/route';
import { unsubscribeToken } from '../lib/waitlist-mail';
const entry={id:'11111111-1111-4111-8111-111111111111',session_hash:createHash('sha256').update('own-cookie').digest('hex')};
const proof=()=>unsubscribeToken(entry);
const request=(token=proof(),origin='https://plsteach.me',cookie='')=>new NextRequest('https://plsteach.me/api/waitlist/unsubscribe',{method:'POST',headers:{origin,'content-type':'application/json',cookie,'x-forwarded-for':`test-${Math.random()}`},body:JSON.stringify({token})});
beforeEach(()=>{vi.clearAllMocks();state.mock=false;state.find.mockResolvedValue({data:entry,error:null});state.remove.mockResolvedValue({error:null});});
describe('waitlist unsubscribe ownership and scanner safety',()=>{
 it('never removes an entry on GET (including mail scanner visits)',()=>{
  expect(GET().status).toBe(405);expect(state.find).not.toHaveBeenCalled();expect(state.deleted).not.toHaveBeenCalled();
 });
 it('removes only the proof-owning entry and clears only its matching browser cookie',async()=>{
  const response=await POST(request(proof(),'https://plsteach.me','pt-signup=own-cookie'));
  expect(response.status).toBe(200);expect(await response.json()).toEqual({removed:true});
  expect(state.remove).toHaveBeenCalledWith('session_hash',entry.session_hash);expect(response.headers.get('set-cookie')).toContain('pt-signup=');
 });
 it('does not clear a different visitor’s cookie',async()=>{
  const response=await POST(request(proof(),'https://plsteach.me','pt-signup=someone-else'));
  expect(response.status).toBe(200);expect(response.headers.get('set-cookie')).toBeNull();
 });
 it('rejects guessed/tampered proofs and cross-origin browser requests',async()=>{
  const invalid=proof().slice(0,37)+'A'.repeat(43);
  expect((await POST(request(invalid))).status).toBe(400);
  expect((await POST(request(proof(),'https://attacker.example'))).status).toBe(403);
  expect(state.deleted).not.toHaveBeenCalled();
 });
 it('is idempotent after the entry has already gone',async()=>{
  state.find.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(200);expect(state.deleted).not.toHaveBeenCalled();
 });
 it.each(['application/x-www-form-urlencoded','APPLICATION/X-WWW-FORM-URLENCODED'])('supports RFC 8058 one-click POST without a browser Origin (%s)',async(contentType)=>{
  const req=new NextRequest(`https://plsteach.me/api/waitlist/unsubscribe?token=${proof()}`,{method:'POST',headers:{'content-type':contentType},body:'List-Unsubscribe=One-Click'});
  expect((await POST(req)).status).toBe(200);expect(state.deleted).toHaveBeenCalledTimes(1);
 });
 it('rejects oversized or unrelated one-click bodies before accessing storage',async()=>{
  const req=new NextRequest(`https://plsteach.me/api/waitlist/unsubscribe?token=${proof()}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'x'.repeat(2048)});
  expect((await POST(req)).status).toBe(400);expect(state.find).not.toHaveBeenCalled();
 });
 it('reports storage errors without treating them as successful removal',async()=>{
  state.remove.mockResolvedValue({error:{message:'private database details'}});
  const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'unavailable'});
 });
});
