import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const auth=vi.hoisted(()=>({exchangeCodeForSession:vi.fn(),verifyOtp:vi.fn(),signInWithOtp:vi.fn()}));
vi.mock('@/lib/auth/server',()=>({authClient:async()=>({auth})}));
import { isSameOrigin,requestOrigin } from '../lib/request-origin';
import { GET as callback } from '../app/auth/callback/route';
import { GET as confirm } from '../app/auth/confirm/route';
import { POST as action } from '../app/api/auth/action/route';
beforeEach(()=>{vi.resetAllMocks();auth.exchangeCodeForSession.mockResolvedValue({error:null});auth.verifyOtp.mockResolvedValue({error:null});auth.signInWithOtp.mockResolvedValue({error:null});});

it('uses the browser-facing host when Next binds an internal address',()=>{
 const request=new Request('http://0.0.0.0:3100/api/trial',{headers:{host:'localhost:3100',origin:'http://localhost:3100','sec-fetch-site':'same-origin'}});
 expect(requestOrigin(request)).toBe('http://localhost:3100');expect(isSameOrigin(request)).toBe(true);
});
it.each<Record<string,string>>([
 {host:'localhost:3100',origin:'https://evil.example'},
 {host:'localhost:3100',origin:'http://localhost:3100','sec-fetch-site':'cross-site'},
 {host:'localhost:3100',origin:'https://evil.example','x-forwarded-host':'evil.example'},
 {host:'localhost:3100'},
])('rejects cross-site or originless authenticated actions: %j',headers=>{
 expect(isSameOrigin(new Request('http://0.0.0.0:3100/api/trial',{headers}))).toBe(false);
});
it.each(['evil.example/path','user@evil.example','evil.example#fragment','evil.example?query'])('does not construct redirects from malformed host %s',host=>{
 expect(requestOrigin(new Request('https://plsteachme.vercel.app/auth/callback',{headers:{host}}))).toBe('https://plsteachme.vercel.app');
});
it('keeps the requested lesson on an email callback without exposing the bind address',async()=>{
 const response=await callback(new NextRequest('http://0.0.0.0:3100/auth/callback?code=fixture&next=%2Flearn%3Fskill%3Dlaundry',{headers:{host:'localhost:3100'}}));
 expect(response.headers.get('location')).toBe('http://localhost:3100/learn?skill=laundry');
 expect(response.headers.get('cache-control')).toBe('private, no-store');
 expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('fixture');
});
it('keeps expired links and email confirmation on the public host',async()=>{
 auth.exchangeCodeForSession.mockResolvedValue({error:{message:'expired'}});
 const headers={host:'localhost:3100'};
 const failed=await callback(new NextRequest('http://0.0.0.0:3100/auth/callback?code=fixture',{headers}));
 expect(failed.headers.get('location')).toBe('http://localhost:3100/login?error=link');
 const confirmed=await confirm(new NextRequest('http://0.0.0.0:3100/auth/confirm?token_hash=fixture',{headers}));
 expect(confirmed.headers.get('location')).toBe('http://localhost:3100/account');
});
it('sends sign-up links back to the validated browser origin with the chosen lesson',async()=>{
 const response=await action(new Request('http://0.0.0.0:3100/api/auth/action',{method:'POST',headers:{host:'localhost:3100',origin:'http://localhost:3100','content-type':'application/json'},body:JSON.stringify({action:'email',email:'tester@example.test',signup:true,next:'/learn?skill=laundry'})}));
 expect(response.status).toBe(200);
 const options=auth.signInWithOtp.mock.calls[0][0].options;
 expect(options.shouldCreateUser).toBe(true);
 const url=new URL(options.emailRedirectTo);expect(url.origin).toBe('http://localhost:3100');expect(url.searchParams.get('next')).toBe('/learn?skill=laundry');
});
