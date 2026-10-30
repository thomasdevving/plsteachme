import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

async function database() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;create table auth.mfa_factors(user_id uuid,status text); create table auth.users(id uuid primary key, email text); create function auth.uid() returns uuid language sql as 'select null::uuid'; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(folder)).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
 return db;
}
const value=async<T,>(db:PGlite,sql:string,params:unknown[]=[])=>(await db.query<{v:T}>(sql,params)).rows[0].v;

it('the progress sync diagnostic checks read/write prerequisites without reading any learner rows',async()=>{
 const db=await database();
 try {
  const sql=await readFile(new URL('../supabase/checks/progress-sync-readiness.sql',import.meta.url),'utf8');
  const check=async()=> (await db.query<{check_name:string;ready:boolean}>(sql)).rows;
  expect((await check()).every(row=>row.ready)).toBe(true);
  expect(await check()).toHaveLength(7);
  await db.exec('revoke select on public.learner_progress from service_role');
  expect((await check()).filter(row=>!row.ready)).toEqual([{check_name:'service_role can read progress',ready:false}]);
  await db.exec('grant select on public.learner_progress to service_role;alter table public.learner_progress rename column client_updated_at to wrong_column');
  expect((await check()).filter(row=>!row.ready)).toEqual([{check_name:'required progress columns exist',ready:false}]);
  await db.exec('drop function public.progress_save(uuid,text,jsonb,bigint);drop table public.learner_progress');
  expect((await check()).every(row=>!row.ready)).toBe(true);
 } finally {await db.close();}
},30_000);

it('the copyable learning-readiness SQL validates every migration and identifies a missing rate limiter',async()=>{
 const db=await database();
 try {
  const sql=await readFile(new URL('../supabase/checks/ai-learning-readiness.sql',import.meta.url),'utf8');
  const checks=(await db.query<{check_name:string;ready:boolean}>(sql)).rows;
  expect(checks).toHaveLength(20);
  expect(checks.every(check=>check.ready)).toBe(true);
  await db.exec('drop function public.rate_hit(text,integer,integer)');
  const missing=(await db.query<{check_name:string;ready:boolean}>(sql)).rows.filter(check=>!check.ready);
  expect(missing).toEqual([{check_name:'function: public.rate_hit',ready:false}]);
 } finally {await db.close();}
},30_000);

it('ends a free session after its AI checks or time and keeps one free session per email address',async()=>{
 const db=await database();
 try {
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  await db.query("insert into auth.users(id,email) values($1,'Learner@Example.test'),($2,'other@example.test')",[a,b]);
  await db.exec('set role service_role;');
  const claim=(user:string,email:string|null)=>value<{id:string;completed_at:string|null}>(db,"select public.claim_coaching_trial($1,'builtin:tie',7,$2) v",[user,email]);
  const trial=await claim(a,'Learner@Example.test');
  expect(trial.completed_at).toBeNull();
  const use=(user:string,id:string,max=3,minutes=120)=>value<string>(db,'select public.coaching_trial_use($1,$2,$3,$4) v',[user,id,max,minutes]);
  expect(await use(b,trial.id)).toBe('missing');
  for(let i=0;i<3;i++)expect(await use(a,trial.id)).toBe('ok');
  expect(await use(a,trial.id)).toBe('exhausted');
  expect(await use(a,trial.id)).toBe('completed');
  // A time limit ends a session too.
  const second=await claim(b,'other@example.test');
  await db.query("update public.coaching_trials set started_at=now()-interval '3 hours' where user_id=$1",[b]);
  expect(await use(b,second.id)).toBe('exhausted');
  // Deleting the account does not give the same address a new free session.
  await db.query("select public.account_delete($1,'learner@example.test')",[a]);
  await db.exec('reset role;');
  await db.query('delete from auth.users where id=$1',[a]);
  const again='33333333-3333-4333-8333-333333333333',noEmail='44444444-4444-4444-8444-444444444444';
  await db.query("insert into auth.users(id,email) values($1,'learner@example.test')",[again]);
  await db.query('insert into auth.users(id) values($1)',[noEmail]);
  await db.exec('set role service_role;');
  expect((await claim(again,'LEARNER@example.test')).completed_at).toBeTruthy();
  const stored=await value<string>(db,'select email_hash v from public.trial_claims limit 1');
  expect(stored).toMatch(/^[a-f0-9]{64}$/);expect(stored).not.toContain('learner');
  // Without an email (unusual), the account still gets its session.
  expect((await claim(noEmail,null)).completed_at).toBeNull();
 } finally { await db.close(); }
},30_000);

it('caps daily AI calls, shares rate limits and hides community requests',async()=>{
 const db=await database();
 try {
  const user='55555555-5555-4555-8555-555555555555';
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.exec('set role service_role;');
  const budget=(kind:string)=>value<boolean>(db,'select public.ai_budget_use($1,3) v',[kind]);
  await expect(db.query("select public.ai_budget_use('DROP TABLE',3)")).rejects.toThrow('check');
  expect([await budget('coaching'),await budget('teacher.draft'),await budget('coaching'),await budget('coaching')]).toEqual([true,true,true,false]);
  const hit=()=>value<boolean>(db,"select public.rate_hit('signup:ip',2,600) v");
  expect([await hit(),await hit(),await hit()]).toEqual([true,true,false]);
  await db.query("update public.rate_limits set window_start=now()-interval '11 minutes'");
  expect(await hit()).toBe(true);
  await db.query("update public.rate_limits set window_start=now()-interval '3 days'");
  await db.query("insert into public.ai_usage(day,kind,calls) values(current_date-500,'coaching',4)");
  expect(await value(db,'select public.ephemeral_cleanup() v')).toEqual({rateLimits:1,aiUsageDays:1});
  await db.query("select public.platform_mutate($1,false,$2::jsonb)",[user,JSON.stringify({action:'request',title:'Fix a bike tire',description:'Show me how to patch a tube.',category:'diy'})]);
  await db.query('update public.community_requests set hidden_at=now(),hidden_by=$1',[user]);
  expect(await value<number>(db,'select count(*)::int v from public.community_requests where hidden_at is null')).toBe(0);
  await db.exec('set role anon;');
  for(const table of ['trial_claims','ai_usage','rate_limits'])await expect(db.query(`select * from public.${table}`)).rejects.toThrow('permission denied');
  await expect(db.query("select public.rate_hit('x',1,1)")).rejects.toThrow('permission denied');
 } finally { await db.close(); }
},30_000);
