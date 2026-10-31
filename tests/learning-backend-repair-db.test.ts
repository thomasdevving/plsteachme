import { expect,it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('applies the combined repair atomically to a partial database and preserves previous feedback and sessions on rerun',async()=>{
 const db=new PGlite();const user='11111111-1111-4111-8111-111111111111';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610170001_accounts_and_trials.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261030170000_lesson_feedback.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1,$2)',[user,'existing@example.test']);
  await db.query("select public.claim_coaching_trial($1,'tie-four-in-hand',7)",[user]);
  await db.query("insert into public.lesson_feedback(user_id,lesson_key,version,rating,comment,created_at,updated_at) values($1,'builtin:tie',1,3,'Original comment','2026-01-01','2026-01-01')",[user]);
  const before=(await db.query('select * from public.lesson_feedback')).rows;
  const trial=(await db.query('select id,started_at from public.coaching_trials')).rows;
  const repair=await readFile(new URL('../supabase/repairs/learning-backend.sql',import.meta.url),'utf8');
  await db.exec(repair);
  expect((await db.query('select * from public.lesson_feedback')).rows).toEqual(before);
  expect((await db.query('select id,started_at from public.coaching_trials')).rows).toEqual(trial);
  const readiness=await readFile(new URL('../supabase/checks/progress-sync-readiness.sql',import.meta.url),'utf8');
  expect((await db.query<{ready:boolean}>(readiness)).rows.every(row=>row.ready)).toBe(true);
  await db.exec('set role service_role');
  await db.query("select public.progress_save($1,'builtin:tie','{\"step\":2}',100)",[user]);
  await db.query("select public.lesson_feedback_save($1,'builtin:tie',2,5,'Improved lesson')",[user]);
  expect((await db.query<{v:unknown}>("select public.lesson_feedback_summary('builtin:tie',1) v")).rows[0].v).toEqual({count:1,average:3});
  expect((await db.query<{v:unknown}>("select public.lesson_feedback_summary('builtin:tie',2) v")).rows[0].v).toEqual({count:1,average:5});
  await db.exec('reset role');
  const claims=(await db.query('select * from public.trial_claims')).rows;
  const progress=(await db.query('select * from public.learner_progress')).rows;
  const reviews=(await db.query('select * from public.lesson_feedback order by version')).rows;
  await db.exec(repair);
  expect((await db.query('select * from public.trial_claims')).rows).toEqual(claims);
  expect((await db.query('select * from public.learner_progress')).rows).toEqual(progress);
  expect((await db.query('select * from public.lesson_feedback order by version')).rows).toEqual(reviews);
  await db.exec('set role anon');await expect(db.query('select * from public.lesson_feedback')).rejects.toThrow(/permission/);
  await expect(db.query("select public.lesson_feedback_save($1,'builtin:tie',1,1,'tamper')",[user])).rejects.toThrow(/permission/);
  await db.exec('reset role;set role authenticated');await expect(db.query('select * from public.lesson_feedback')).rejects.toThrow(/permission/);
 }finally{await db.close();}
},30_000);
