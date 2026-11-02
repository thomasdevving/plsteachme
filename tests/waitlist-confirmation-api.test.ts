import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({mock:false,insert:vi.fn(),existing:vi.fn(),send:vi.fn(),under:vi.fn()}));
vi.mock('@/lib/waitlist-mail',()=>({sendWaitlistConfirmation:state.send}));
vi.mock('@/lib/storage',()=>({get mockMode(){return state.mock;},hash:(value:string)=>'hash:'+value,token:()=> 'new-secret',record:vi.fn(),under16Count:state.under,
 db:()=>({from:(table:string)=>table==='waitlist'?{insert:()=>({select:()=>({single:state.insert})}),select:()=>({eq:()=>({maybeSingle:state.existing})})}:{update:()=>({eq:async()=>({error:null})})}})}));
import { POST } from '../app/api/waitlist/route';
const entry={id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test',session_hash:'a'.repeat(64)};
const payload={age:'25-34',email:entry.email,skills:[],consent:true,attribution:{language:'en'}};
const request=(body:unknown)=>new NextRequest('https://plsteach.me/api/waitlist',{method:'POST',headers:{origin:'https://plsteach.me','content-type':'application/json','x-forwarded-for':`test-${Math.random()}`},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();state.mock=false;state.insert.mockResolvedValue({data:entry,error:null});state.existing.mockResolvedValue({data:entry,error:null});state.send.mockResolvedValue(true);});
describe('waitlist confirmation delivery',()=>{
 it('acknowledges provider-accepted mail and only gives the new signup its own cookie',async()=>{
  const response=await POST(request(payload));expect(response.status).toBe(200);
  expect(await response.json()).toEqual({accepted:true});expect(state.send).toHaveBeenCalledWith(entry);
  expect(response.headers.get('set-cookie')).toContain('pt-signup=new-secret');
 });
 it('does not silently report success when the mail cannot be sent; the saved entry remains retryable',async()=>{
  state.send.mockResolvedValue(false);const response=await POST(request(payload));
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'email',saved:true});
  expect(response.headers.get('set-cookie')).toContain('pt-signup=new-secret');
 });
 it('can retry an existing email without replacing or issuing its private session',async()=>{
  state.insert.mockResolvedValue({data:null,error:{code:'23505'}});
  const response=await POST(request(payload));expect(response.status).toBe(200);expect(state.send).toHaveBeenCalledWith(entry);
  expect(response.headers.get('set-cookie')).toBeNull();expect(await response.json()).toEqual({accepted:true});
 });
 it('never sends mail for under-16, honeypot or preview requests',async()=>{
  await POST(request({age:'under16'}));await POST(request({...payload,website:'bot'}));
  state.mock=true;await POST(request(payload));expect(state.send).not.toHaveBeenCalled();
 });
});
