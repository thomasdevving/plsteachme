import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('restores missing progress storage, safely reruns and preserves private, monotonic account data', async () => {
 const db = new PGlite();
 const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);');
  const repair=await readFile(new URL('../supabase/migrations/20261030203000_restore_progress_sync.sql',import.meta.url),'utf8');
  const diagnostic=await readFile(new URL('../supabase/checks/progress-sync-readiness.sql',import.meta.url),'utf8');
  const check=async()=> (await db.query<{check_name:string;ready:boolean}>(diagnostic)).rows;
  expect((await check()).every(row=>!row.ready)).toBe(true);
  await db.query('insert into auth.users values($1,$2),($3,$4)',[owner,'owner@example.test',other,'other@example.test']);
  await db.exec(repair);
  expect(await check()).toHaveLength(7);expect((await check()).every(row=>row.ready)).toBe(true);
  await db.exec('set role service_role');
  const save=async(user:string,step:number,time:number)=> (await db.query<{v:{data:{step:number};updatedAt:number}}>("select public.progress_save($1,'builtin:tie',$2::jsonb,$3) v",[user,JSON.stringify({step}),time])).rows[0].v;
  await save(owner,4,200);await save(other,1,100);
  expect(await save(owner,2,100)).toMatchObject({data:{step:4},updatedAt:200});
  expect(await save(owner,3,200)).toMatchObject({data:{step:4},updatedAt:200});
  expect(await save(owner,5,300)).toMatchObject({data:{step:5},updatedAt:300});
  await db.exec('reset role');
  // Simulate bad historical grants; rerunning repairs them without deleting rows.
  await db.exec('grant select on public.learner_progress to anon,authenticated;grant execute on function public.progress_save(uuid,text,jsonb,bigint) to public;revoke update on public.learner_progress from service_role');
  await db.exec(repair);
  expect((await check()).every(row=>row.ready)).toBe(true);
  expect((await db.query('select id from auth.users')).rows).toHaveLength(2);
  expect((await db.query<{enabled:boolean}>("select relrowsecurity enabled from pg_class where oid='public.learner_progress'::regclass")).rows[0].enabled).toBe(true);
  await db.exec('set role anon');
  await expect(db.query('select * from public.learner_progress')).rejects.toThrow(/permission/);
  await expect(save(owner,0,999)).rejects.toThrow(/permission/);
  await db.exec('reset role;set role authenticated');
  await expect(db.query('select * from public.learner_progress')).rejects.toThrow(/permission/);
  await expect(save(other,0,999)).rejects.toThrow(/permission/);
  await db.exec('reset role;set role service_role');
  expect((await db.query<{user_id:string;data:{step:number}}>('select user_id,data from public.learner_progress order by user_id')).rows).toEqual([{user_id:owner,data:{step:5}},{user_id:other,data:{step:1}}]);
  await expect(db.query("select public.progress_save($1,'../invalid','{}',1)",[owner])).rejects.toThrow(/check/);
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1',[owner]);
  expect((await db.query('select user_id from public.learner_progress')).rows).toEqual([{user_id:other}]);
 } finally {await db.close();}
},30_000);
