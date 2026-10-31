import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('repairs a legacy coaching installation without renewing sessions, claims or budgets',async()=>{
 const db=new PGlite();
 const old='11111111-1111-4111-8111-111111111111',fresh='22222222-2222-4222-8222-222222222222',again='33333333-3333-4333-8333-333333333333';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610170001_accounts_and_trials.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1,$2),($3,$4)',[old,'Existing@Example.test',fresh,'fresh@example.test']);
  await db.query("select public.claim_coaching_trial($1,'tie-four-in-hand',7)",[old]);
  await db.query('update public.coaching_trials set completed_steps=3 where user_id=$1',[old]);
  const before=(await db.query('select id,started_at,completed_steps from public.coaching_trials where user_id=$1',[old])).rows[0];
  const sql=await readFile(new URL('../supabase/migrations/20261031100000_restore_coaching_sessions.sql',import.meta.url),'utf8');
  await db.exec(sql);
  expect((await db.query("select to_regprocedure('public.claim_coaching_trial(uuid,text,integer)') old,to_regprocedure('public.claim_coaching_trial(uuid,text,integer,text)') current")).rows[0]).toMatchObject({old:null});
  expect((await db.query('select id,started_at,completed_steps from public.coaching_trials where user_id=$1',[old])).rows[0]).toEqual(before);
  await db.exec('set role service_role');
  const claim=async(id:string,email:string)=>(await db.query<{v:{id:string;completed_at:string|null;completed_steps:number}}>("select public.claim_coaching_trial($1,'tie-four-in-hand',7,$2) v",[id,email])).rows[0].v;
  const use=async(id:string,trial:string)=>(await db.query<{v:string}>('select public.coaching_trial_use($1,$2,2,120) v',[id,trial])).rows[0].v;
  const trial=await claim(fresh,'fresh@example.test');expect(trial.completed_at).toBeNull();
  expect(await use(fresh,trial.id)).toBe('ok');
  expect((await claim(old,'Existing@Example.test')).completed_steps).toBe(3);
  await db.exec("select public.ai_budget_use('coaching',1);select public.rate_hit('coaching-test',1,900)");
  await db.exec('reset role');
  const counters=(await db.query('select * from public.ai_usage')).rows;
  const rate=(await db.query('select * from public.rate_limits')).rows;
  await db.exec(sql);
  expect((await db.query('select * from public.ai_usage')).rows).toEqual(counters);
  expect((await db.query('select * from public.rate_limits')).rows).toEqual(rate);
  expect((await db.query<{ai_calls:number}>('select ai_calls from public.coaching_trials where user_id=$1',[fresh])).rows[0].ai_calls).toBe(1);
  await db.exec('set role service_role');
  expect(await use(fresh,trial.id)).toBe('ok');expect(await use(fresh,trial.id)).toBe('exhausted');
  expect((await db.query<{v:boolean}>("select public.ai_budget_use('coaching',1) v")).rows[0].v).toBe(false);
  expect((await db.query<{v:boolean}>("select public.rate_hit('coaching-test',1,900) v")).rows[0].v).toBe(false);
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1',[fresh]);
  await db.query('insert into auth.users values($1,$2)',[again,'FRESH@example.test']);
  await db.exec('set role service_role');
  expect((await claim(again,'FRESH@example.test')).completed_at).not.toBeNull();
  await db.exec('reset role;set role anon');
  await expect(claim(old,'existing@example.test')).rejects.toThrow(/permission/);
  await expect(db.query('select * from public.trial_claims')).rejects.toThrow(/permission/);
  await db.exec('reset role;set role authenticated');
  await expect(claim(old,'existing@example.test')).rejects.toThrow(/permission/);
  await expect(db.query('update public.coaching_trials set completed_at=null')).rejects.toThrow(/permission/);
 }finally{await db.close();}
},30_000);

it('also provisions a fresh project without granting browser access to private trial data',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);');
  await db.exec(await readFile(new URL('../supabase/migrations/20261031100000_restore_coaching_sessions.sql',import.meta.url),'utf8'));
  const rows=(await db.query<{name:string;ready:boolean}>(`select proname name,true ready from pg_proc where oid in (
    to_regprocedure('public.claim_coaching_trial(uuid,text,integer,text)'),to_regprocedure('public.coaching_trial_use(uuid,uuid,integer,integer)'),
    to_regprocedure('public.advance_coaching_trial(uuid,uuid,integer)'),to_regprocedure('public.ai_budget_use(text,integer)'),to_regprocedure('public.rate_hit(text,integer,integer)'))`)).rows;
  expect(rows).toHaveLength(5);
  await db.exec('set role authenticated');await expect(db.query('select * from public.coaching_trials')).rejects.toThrow(/permission/);
 }finally{await db.close();}
},30_000);
