import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

async function database() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key, email text); create function auth.uid() returns uuid language sql as 'select null::uuid'; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(folder)).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
 return db;
}
const value=async<T,>(db:PGlite,sql:string,params:unknown[]=[])=>(await db.query<{v:T}>(sql,params)).rows[0].v;
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',trial='33333333-3333-4333-8333-333333333333';
const tool='a'.repeat(64),browser='b'.repeat(64),otherTool='c'.repeat(64),otherBrowser='d'.repeat(64);
type Start={result:string;remaining_seconds?:number;session?:{id:string;revision:number;step:number}};
const start=(db:PGlite,user=a,{max=300,allowance=900,daily=6000,toolHash=tool,browserHash=browser,step=0}={})=>
 value<Start>(db,"select public.voice_session_start($1,$2,'builtin:tie',1,7,$3,$4,$5,$6,$7,$8) v",[user,trial,step,max,allowance,daily,toolHash,browserHash]);
const allowance=(db:PGlite,user=a)=>db.query<{reserved_seconds:number;used_seconds:number}>('select reserved_seconds,used_seconds from public.voice_allowances where user_id=$1',[user]).then(r=>r.rows[0]);

async function seeded() {
 const db=await database();
 await db.query('insert into auth.users(id) values($1),($2)',[a,b]);
 await db.exec('set role service_role;');
 return db;
}

it('reserves voice minutes, allows one open session per learner and reconciles once from the execution record',async()=>{
 const db=await seeded();
 try {
  const first=await start(db);
  expect(first.result).toBe('ok');
  const id=first.session!.id;
  expect(await allowance(db)).toEqual({reserved_seconds:300,used_seconds:0});
  // A second start while the first is live (a double click or second tab) is refused.
  expect((await start(db)).result).toBe('busy');
  expect(await value<boolean>(db,'select public.voice_session_bind($1,$2,$3) v',[id,b,'run-1234567890'])).toBe(false);
  expect(await value<boolean>(db,'select public.voice_session_bind($1,$2,$3) v',[id,a,'run-1234567890'])).toBe(true);
  // Binding happens once; a later mint cannot rebind the session to another execution.
  expect(await value<boolean>(db,'select public.voice_session_bind($1,$2,$3) v',[id,a,'run-other-0000000'])).toBe(false);
  expect(await value<string>(db,"select public.voice_session_reconcile('run-1234567890',95) v")).toBe('ok');
  expect(await value<string>(db,"select public.voice_session_reconcile('run-1234567890',95) v")).toBe('duplicate');
  expect(await allowance(db)).toEqual({reserved_seconds:0,used_seconds:95});
  expect(await value<number>(db,'select seconds v from public.voice_daily_usage')).toBe(95);
  // 900 - 95 = 805 seconds remain: two more full reservations fit, a third does not.
  expect((await start(db)).result).toBe('ok');
  await db.query("update public.voice_sessions set last_seen_at=now()-interval '1 minute' where status<>'ended'");
  // An abandoned session is replaced, but its unreconciled reservation stays counted.
  expect((await start(db)).result).toBe('ok');
  await db.query("update public.voice_sessions set last_seen_at=now()-interval '1 minute' where status<>'ended'");
  expect(await start(db)).toEqual({result:'allowance',remaining_seconds:205});
  expect((await db.query<{end_reason:string}>('select end_reason from public.voice_sessions where reconciled_at is null')).rows).toEqual([{end_reason:'abandoned'},{end_reason:'abandoned'}]);
  // A call that never connected is refunded in full, once.
  const last=await value<string>(db,'select id v from public.voice_sessions order by created_at desc limit 1');
  expect(await value<boolean>(db,'select public.voice_session_release($1,$2,$3) v',[last,b,'mint_failed'])).toBe(false);
  expect(await value<boolean>(db,'select public.voice_session_release($1,$2,$3) v',[last,a,'mint_failed'])).toBe(true);
  expect(await value<boolean>(db,'select public.voice_session_release($1,$2,$3) v',[last,a,'mint_failed'])).toBe(false);
  expect(await allowance(db)).toEqual({reserved_seconds:300,used_seconds:95});
 } finally { await db.close(); }
},30_000);

it('enforces the service-wide daily voice limit',async()=>{
 const db=await seeded();
 try {
  expect((await start(db,a,{daily:500})).result).toBe('ok');
  expect((await start(db,b,{daily:500,toolHash:otherTool,browserHash:otherBrowser})).result).toBe('daily');
 } finally { await db.close(); }
},30_000);

it('scopes tool and browser access to their own tokens',async()=>{
 const db=await seeded();
 try {
  const id=(await start(db)).session!.id;
  await db.query('select public.voice_session_bind($1,$2,$3)',[id,a,'run-1234567890']);
  expect(await value(db,'select public.voice_tool_session($1,$2) v',[id,otherTool])).toBeNull();
  expect(await value(db,'select public.voice_tool_session($1,$2) v',[id,browser])).toBeNull();
  expect(await value(db,'select public.voice_poll($1,$2) v',[id,otherBrowser])).toBeNull();
  expect(await value(db,'select public.voice_poll($1,$2) v',[id,tool])).toBeNull();
  expect(await value(db,'select public.voice_command_enqueue($1,$2,$3,$4) v',[id,otherTool,'next',0])).toEqual({result:'not_found'});
  expect(await value(db,'select public.voice_session_end($1,$2,$3) v',[id,otherBrowser,'stopped'])).toBe(false);
  expect(await value<{step:number}>(db,'select public.voice_tool_session($1,$2) v',[id,tool])).toMatchObject({step:0,status:'active',lesson_key:'builtin:tie'});
  await db.exec('set role anon;');
  for(const table of ['voice_sessions','voice_commands','voice_allowances','voice_webhook_deliveries'])await expect(db.query(`select * from public.${table}`)).rejects.toThrow('permission denied');
  await expect(db.query('select public.voice_poll($1,$2)',[id,browser])).rejects.toThrow('permission denied');
 } finally { await db.close(); }
},30_000);

it('deduplicates commands, rejects stale revisions and applies each action once',async()=>{
 const db=await seeded();
 try {
  const id=(await start(db)).session!.id;
  const enqueue=(action:string,step:number|null)=>value<{result:string;duplicate?:boolean;command_id?:string}>(db,'select public.voice_command_enqueue($1,$2,$3,$4) v',[id,tool,action,step]);
  const ack=(command:string,applied:boolean,step:number|null)=>value<{result:string;revision?:number;step?:number}>(db,'select public.voice_command_ack($1,$2,$3,$4,$5) v',[id,browser,command,applied,step]);
  const poll=()=>value<{status:string;revision:number;step:number;commands:{id:string;action:string}[]}>(db,'select public.voice_poll($1,$2) v',[id,browser]);
  expect((await enqueue('next',0)).result).toBe('not_ready');
  await db.query('select public.voice_session_bind($1,$2,$3)',[id,a,'run-1234567890']);
  const next=await enqueue('next',0);
  expect(next).toMatchObject({result:'queued',duplicate:false});
  // A retried tool call at the same revision returns the same command.
  const retry=await enqueue('next',0);
  expect(retry).toMatchObject({result:'queued',duplicate:true,command_id:next.command_id});
  expect((await poll()).commands).toEqual([{id:next.command_id,action:'next',revision:1,step:0}]);
  expect(await ack(next.command_id!,true,1)).toMatchObject({result:'applied',revision:2,step:1});
  expect(await ack(next.command_id!,true,2)).toMatchObject({result:'duplicate'});
  expect((await poll())).toMatchObject({revision:2,step:1,commands:[]});
  // The agent still believes it is on step 1 of 7 (index 0): the request is rejected.
  expect(await enqueue('next',0)).toMatchObject({result:'stale',step:1});
  // The learner taps Back while a spoken "next" is pending: the command goes stale.
  const pending=await enqueue('next',1);
  expect(await value(db,'select public.voice_session_state($1,$2,$3,false,null) v',[id,browser,0])).toMatchObject({result:'changed',revision:3,step:0});
  expect((await poll()).commands).toEqual([]);
  expect(await ack(pending.command_id!,true,2)).toMatchObject({result:'stale',step:0});
  expect(await value<string>(db,'select step::text v from public.voice_sessions where id=$1',[id])).toBe('0');
 } finally { await db.close(); }
},30_000);

it('pause blocks lesson actions and camera observations until resumed, and stop ends the session',async()=>{
 const db=await seeded();
 try {
  const id=(await start(db)).session!.id;
  await db.query('select public.voice_session_bind($1,$2,$3)',[id,a,'run-1234567890']);
  const enqueue=(action:string,step:number|null=null)=>value<{result:string;command_id?:string}>(db,'select public.voice_command_enqueue($1,$2,$3,$4) v',[id,tool,action,step]);
  const ack=(command:string)=>value<{result:string;status?:string}>(db,'select public.voice_command_ack($1,$2,$3,true,null) v',[id,browser,command]);
  const observe=(step:number,key:string|null,lesson='builtin:tie')=>value<{recorded:boolean;announce?:boolean;reason?:string}>(db,'select public.voice_observe($1,$2,$3,$4,$5::jsonb,$6) v',[id,browser,lesson,step,JSON.stringify({status:'adjust',confidence:'high',observation:'The wide end is short.',guidance:'Pull the wide end lower.'}),key]);
  expect(await ack((await enqueue('pause')).command_id!)).toMatchObject({result:'applied',status:'paused'});
  expect(await enqueue('next',0)).toMatchObject({result:'paused'});
  expect(await observe(0,'0:adjust')).toEqual({recorded:false,reason:'paused'});
  expect(await ack((await enqueue('resume')).command_id!)).toMatchObject({status:'active'});
  expect(await observe(0,'0:adjust')).toMatchObject({recorded:true,announce:true});
  // The same result again is recorded but not announced a second time.
  expect(await observe(0,'0:adjust')).toMatchObject({recorded:true,announce:false});
  expect(await observe(1,'1:adjust')).toEqual({recorded:false,reason:'stale'});
  expect(await observe(0,'0:adjust','builtin:button')).toEqual({recorded:false,reason:'stale'});
  expect(await value<{observation:{step:number}}>(db,'select public.voice_tool_session($1,$2) v',[id,tool])).toMatchObject({observation:{status:'adjust',step:0,revision:3}});
  // The on-screen pause control has the same effect as a spoken pause.
  const state=(paused:boolean|null)=>value<{result:string;status?:string;step_changed?:boolean}>(db,'select public.voice_session_state($1,$2,0,false,$3) v',[id,browser,paused]);
  expect(await state(true)).toMatchObject({result:'changed',status:'paused',step_changed:false});
  expect(await observe(0,'0:looks_right')).toEqual({recorded:false,reason:'paused'});
  expect(await state(true)).toMatchObject({result:'unchanged',status:'paused'});
  expect(await state(false)).toMatchObject({result:'changed',status:'active'});
  expect(await ack((await enqueue('stop')).command_id!)).toMatchObject({status:'ended'});
  expect(await value<{observation:unknown}>(db,'select public.voice_tool_session($1,$2) v',[id,tool])).toMatchObject({status:'ended',observation:null});
  expect(await enqueue('resume')).toEqual({result:'ended'});
 } finally { await db.close(); }
},30_000);

it('expires sessions past their maximum duration and deduplicates webhook deliveries',async()=>{
 const db=await seeded();
 try {
  const id=(await start(db)).session!.id;
  await db.query('select public.voice_session_bind($1,$2,$3)',[id,a,'run-1234567890']);
  await db.query("update public.voice_sessions set expires_at=now()-interval '1 second' where id=$1",[id]);
  expect(await value(db,'select public.voice_command_enqueue($1,$2,$3,$4) v',[id,tool,'next',0])).toEqual({result:'ended'});
  expect(await value<{status:string}>(db,'select public.voice_poll($1,$2) v',[id,browser])).toMatchObject({status:'ended',end_reason:'expired'});
  const key='e'.repeat(64);
  expect(await value<boolean>(db,'select public.voice_webhook_seen($1) v',[key])).toBe(true);
  expect(await value<boolean>(db,'select public.voice_webhook_seen($1) v',[key])).toBe(false);
  await expect(db.query("select public.voice_webhook_seen('not-a-hash')")).rejects.toThrow('check');
  expect(await value(db,'select public.voice_cleanup() v')).toMatchObject({webhookKeys:0});
 } finally { await db.close(); }
},30_000);
