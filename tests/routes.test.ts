import { describe,it,expect,vi,beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
const storage=vi.hoisted(()=>{
 const single=vi.fn(); const maybeSingle=vi.fn(); const insert=vi.fn(); const upsert=vi.fn(); const update=vi.fn();
 const chain={insert,upsert,update,select:vi.fn(),eq:vi.fn(),single,maybeSingle};
 chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); insert.mockReturnValue(chain); update.mockReturnValue(chain);
 return {chain, from:vi.fn(()=>chain),under16Count:vi.fn(),record:vi.fn(),counter:0};
});
vi.mock('@/lib/storage',()=>({db:()=>({from:storage.from}),mockMode:false,record:storage.record,under16Count:storage.under16Count,hash:(v:string)=>`hashed-${v}`,token:()=>`opaque-token-${++storage.counter}`}));
vi.mock('server-only',()=>({}));
import { POST as signup } from '../app/api/waitlist/route';
import { POST as followup } from '../app/api/followup/route';
import { GET as session } from '../app/api/session/route';
function req(path:string,body?:unknown,cookie='') {return new NextRequest(`http://localhost:3100/api/${path}`,{method:body?'POST':'GET',headers:{Host:'localhost:3100',Origin:'http://localhost:3100','Content-Type':'application/json','x-forwarded-for':`test-${Math.random()}`,...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
beforeEach(()=>{vi.clearAllMocks();storage.chain.single.mockResolvedValue({data:{id:'record-1'},error:null});storage.chain.maybeSingle.mockResolvedValue({data:{id:'record-1',referral_code:'PUBLIC123'},error:null});storage.chain.upsert.mockResolvedValue({error:null});});
describe('server authorization and stored data boundaries',()=>{
 it('under-16 increments only the aggregate even when personal data is submitted',async()=>{const response=await signup(req('waitlist',{age:'under16',email:'child@example.com',other:'secret',attribution:{language:'nl'}}));expect(await response.json()).toEqual({under16:true});expect(storage.under16Count).toHaveBeenCalledTimes(1);expect(storage.from).not.toHaveBeenCalled();expect(storage.record).not.toHaveBeenCalled();});
 it('stores validated adult signup with a hashed session token and an independent public referral code',async()=>{const response=await signup(req('waitlist',{age:'18-24',email:'TEST@example.com',skills:['tie'],consent:true,attribution:{language:'nl',referral:'FRIEND'}}));expect(response.status).toBe(200);expect(storage.chain.insert.mock.calls[0][0]).toMatchObject({email:'test@example.com',consent:true,age_bracket:'18-24',session_hash:expect.stringMatching(/^hashed-/),attribution:{referral:'FRIEND'}});expect(response.headers.get('set-cookie')).toContain('HttpOnly');const body=await response.json();expect(body).toEqual({accepted:true});expect(JSON.stringify(body)).not.toContain('opaque-token');});
 it('duplicate email never grants a session to an existing signup',async()=>{storage.chain.single.mockResolvedValue({data:null,error:{code:'23505'}});const response=await signup(req('waitlist',{age:'18-24',email:'test@example.com',consent:true,attribution:{language:'en'}}));expect(response.headers.get('set-cookie')).toBeNull();expect(await response.json()).toEqual({accepted:true});});
 it('no follow-up can be written with only a user-supplied id or referral',async()=>{const response=await followup(req('followup',{answer:'a skill',id:'victim',referral:'PUBLIC123'}));expect(response.status).toBe(401);expect(storage.chain.upsert).not.toHaveBeenCalled();});
 it('links follow-up to the cookie-authorized record, ignoring an injected id',async()=>{const response=await followup(req('followup',{answer:'Sewing',waitlist_id:'victim'},'pt-signup=secret'));expect(response.status).toBe(200);expect(storage.chain.eq).toHaveBeenCalledWith('session_hash','hashed-secret');expect(storage.chain.upsert).toHaveBeenCalledWith({waitlist_id:'record-1',answer:'Sewing'},{onConflict:'waitlist_id'});});
 it('unknown session never receives a referral code',async()=>{storage.chain.maybeSingle.mockResolvedValue({data:null,error:null});const response=await session(req('session',undefined,'pt-signup=unknown'));expect(await response.json()).toEqual({referral:null});});
});
