import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

it('stores landmark clips, keeps one active model per lesson and only activates models that passed the gate',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261020090000_vision_models.sql',import.meta.url),'utf8'));
  const staff='11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users(id) values($1)',[staff]);
  await db.exec('set role service_role;');
  const frames=JSON.stringify(Array.from({length:10},()=>[0,1]));
  await db.query(`insert into vision_clips(target,label,contributor_id,source,feature_version,frames,hand_rate,consent_version) values('builtin:tie','s0',$1,'camera',1,$2,1,'2026-10-20')`,[staff,frames]);
  await expect(db.query(`insert into vision_clips(target,label,contributor_id,source,feature_version,frames,hand_rate,consent_version) values('builtin:tie','s0',$1,'camera',1,'[[0]]',1,'v')`,[staff])).rejects.toThrow('check');
  await expect(db.query(`insert into vision_clips(target,label,contributor_id,source,feature_version,frames,hand_rate,consent_version) values('../x','s0',$1,'camera',1,$2,1,'v')`,[staff,frames])).rejects.toThrow('check');
  const model=async(version:number,passed:boolean)=>(await db.query<{id:string}>(`insert into vision_models(target,version,labels,model,metrics,gate,dataset_clips,feature_version,trained_by) values('builtin:tie',$1,'[]','{}','{}',$2,6,1,$3) returning id`,[version,JSON.stringify({passed,reasons:[]}),staff])).rows[0].id;
  const failed=await model(1,false),first=await model(2,true),second=await model(3,true);
  const activate=(id:string)=>db.query('select public.vision_activate($1,$2)',[staff,id]);
  await expect(activate(failed)).rejects.toThrow('conflict');
  await activate(first);await activate(second);
  const statuses=(await db.query<{version:number;status:string}>("select version,status from vision_models order by version")).rows;
  expect(statuses).toEqual([{version:1,status:'candidate'},{version:2,status:'retired'},{version:3,status:'active'}]);
  await expect(activate(first)).rejects.toThrow('conflict');
  await expect(db.query("update vision_models set status='active' where version=1")).rejects.toThrow('vision_models_one_active');
  await db.query(`insert into vision_shadow_checks(model_id,step,predicted,confidence,coach_status,agrees) values($1,0,'s0',.9,'looks_right',true)`,[second]);
  await db.exec('reset role;set role authenticated;');
  await expect(db.query('select * from vision_clips')).rejects.toThrow('permission denied');
  await expect(activate(failed)).rejects.toThrow('permission denied');
 } finally { await db.close(); }
},30000);
