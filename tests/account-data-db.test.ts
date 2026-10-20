import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

async function database() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid'; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(folder)).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
 return db;
}
const one=async<T,>(db:PGlite,sql:string,params:unknown[]=[])=>(await db.query<T>(sql,params)).rows[0];
const step=(title:string)=>({title,instruction:'Do it',tip:'',check:'Done',evidence:['Visible'],commonMistakes:[],uncertainty:'Closer',manualAlternative:'Check',visuallyCheckable:true});
const document={title:'A lesson',category:'clothing',objective:'Learn a thing well',materials:['Tie'],safety:['Careful'],prerequisites:[],alternatives:[],completionCheck:'Check it',steps:[step('One')]};

it('keeps the newest progress, summarizes learning events and cleans up by retention rules',async()=>{
 const db=await database();
 try {
  const user='11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.exec('set role service_role;');
  const save=(data:unknown,updated:number)=>one<{result:{data:unknown;updatedAt:number}}>(db,'select public.progress_save($1,$2,$3::jsonb,$4) as result',[user,'builtin:tie',JSON.stringify(data),updated]);
  await save({step:2},200);
  expect((await save({step:1},100))!.result).toMatchObject({data:{step:2},updatedAt:200});
  expect((await save({step:4},300))!.result).toMatchObject({data:{step:4},updatedAt:300});
  await expect(db.query("select public.progress_save($1,'../etc',$2::jsonb,1)",[user,'{}'])).rejects.toThrow('check');

  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  for(const [session,kind,step,result] of [[a,'lesson_start',null,''],[a,'step',0,'camera_confirmed'],[a,'step',1,'self_checked'],[a,'lesson_complete',null,''],[b,'lesson_start',null,''],[b,'step',0,'unresolved'],[null,'coach',0,'looks_right'],[null,'coach',0,'unclear']] as const)
   await db.query('insert into learning_events(session_id,lesson_key,kind,step,result) values($1,$2,$3,$4,$5)',[session,'builtin:tie',kind,step,result]);
  const insights=(await one<{result:any}>(db,"select public.learning_insights(now()-interval '1 day') as result"))!.result;
  expect(insights.learners).toBe(2);
  const tie=insights.lessons[0];
  expect(tie).toMatchObject({lessonKey:'builtin:tie',starts:2,completions:1,coachChecks:2});
  expect(tie.steps[0]).toMatchObject({step:0,learners:2,camera_confirmed:1,unresolved:1,looks_right:1,unclear:1});
  expect(tie.steps[1]).toMatchObject({step:1,learners:1,self_checked:1});
  await expect(db.query("insert into learning_events(lesson_key,kind,result) values('builtin:tie','step','Free text!')")).rejects.toThrow('check');

  await db.query(`insert into coaching_reports(skill,step,status,confidence,observation,guidance,reason,created_at,resolved_at) values('tie',0,'unclear','low','o','g','old resolved',now()-interval '200 days',now()-interval '190 days'),('tie',0,'unclear','low','o','g','recent',now(),null)`);
  await db.query("insert into learning_events(lesson_key,kind,created_at) values('builtin:tie','lesson_start',now()-interval '500 days')");
  const cleanup=(await one<{result:any}>(db,'select public.retention_cleanup() as result'))!.result;
  expect(cleanup).toMatchObject({reports:1,events:1});
  expect((await one<{count:number}>(db,'select count(*)::int as count from coaching_reports'))!.count).toBe(1);
 } finally { await db.close(); }
},60000);

it('deletes an account with its teacher, community, learning and organization data',async()=>{
 const db=await database();
 try {
  const teacher='11111111-1111-4111-8111-111111111111',reviewer='22222222-2222-4222-8222-222222222222',colleague='33333333-3333-4333-8333-333333333333';
  await db.query('insert into auth.users(id) values($1),($2),($3)',[teacher,reviewer,colleague]);
  await db.exec('set role service_role;');
  const platform=async(actor:string,review:boolean,payload:Record<string,unknown>)=>(await one<{result:any}>(db,'select public.platform_mutate($1::uuid,$2::boolean,$3::jsonb) as result',[actor,review,JSON.stringify(payload)]))!.result;
  const training=async(actor:string,email:string,payload:Record<string,unknown>)=>(await one<{result:any}>(db,'select public.training_mutate($1::uuid,$2,$3::jsonb) as result',[actor,email,JSON.stringify(payload)]))!.result;
  // A published teacher lesson, with immutable versions and reviews.
  await platform(teacher,false,{action:'apply',displayName:'Teacher',expertise:'Clothing skills',experience:'Many years teaching knots',qualifications:''});
  const profile=(await one<{updated_at:string}>(db,'select updated_at from teacher_profiles where user_id=$1',[teacher]))!;
  await platform(reviewer,true,{action:'reviewApplication',userId:teacher,expectedUpdatedAt:profile.updated_at,decision:'approve',notes:'Reviewed independently'});
  const {lessonId}=await platform(teacher,false,{action:'create',document,contributionLicense:true,licenseVersion:'v',trainingOptIn:true});
  const path=`${teacher}/${lessonId}/44444444-4444-4444-8444-444444444444.mp4`;
  await platform(teacher,false,{action:'registerUpload',lessonId,path,size:10,contentType:'video/mp4'});
  await platform(teacher,false,{action:'attach',lessonId,path});
  const updated=(await one<{updated_at:string}>(db,'select updated_at from platform_lessons where id=$1',[lessonId]))!;
  await platform(teacher,false,{action:'submit',lessonId,expectedUpdatedAt:updated.updated_at});
  const version=(await one<{submitted_version_id:string}>(db,'select submitted_version_id from platform_lessons where id=$1',[lessonId]))!;
  await platform(reviewer,true,{action:'reviewLesson',lessonId,expectedVersionId:version.submitted_version_id,decision:'publish',notes:'Published after review'});
  await expect(db.query('delete from platform_lesson_versions')).rejects.toThrow('immutable history');
  // Community, learning and model data.
  const {requestId}=await platform(teacher,false,{action:'request',title:'Fold a shirt',description:'Please teach folding',category:'clothing'});
  const {requestId:other}=await platform(reviewer,false,{action:'request',title:'Iron a shirt',description:'Please teach ironing',category:'clothing'});
  await platform(teacher,false,{action:'support',requestId:other,support:true});
  await db.query("select public.progress_save($1,'builtin:tie','{}'::jsonb,1)",[teacher]);
  await db.query(`insert into vision_clips(target,label,contributor_id,source,feature_version,frames,hand_rate,consent_version) values('builtin:tie','s0',$1,'camera',1,$2,1,'v')`,[teacher,JSON.stringify(Array.from({length:10},()=>[0]))]);
  await db.query("insert into waitlist(email,age_bracket,consent,consent_version,referral_code,session_hash) values('teacher@example.test','18-24',true,'v','r1','s1')");
  // Organizations: one the teacher runs alone, one shared with a colleague.
  const {organizationId:solo}=await training(teacher,'teacher@example.test',{action:'org.create',name:'Solo',kind:'business',plan:'up-to-25'});
  await training(teacher,'teacher@example.test',{action:'module.create',organizationId:solo,source:'blank',document});
  const {organizationId:shared}=await training(colleague,'colleague@example.test',{action:'org.create',name:'Shared',kind:'school',plan:'up-to-25'});
  await training(colleague,'colleague@example.test',{action:'member.invite',organizationId:shared,role:'admin',invites:[{email:'teacher@example.test',tokenHash:'a'.repeat(64)}]});
  await training(teacher,'teacher@example.test',{action:'member.accept',tokenHash:'a'.repeat(64)});
  const {moduleId}=await training(teacher,'teacher@example.test',{action:'module.create',organizationId:shared,source:'blank',document});
  await training(teacher,'teacher@example.test',{action:'module.publish',moduleId,audience:'all',memberIds:[]});

  const result=(await one<{result:any}>(db,'select public.account_delete($1,$2) as result',[teacher,'Teacher@Example.test']))!.result;
  expect(result.demoPaths).toEqual([path]);
  await db.exec('reset role;');
  await db.query('delete from auth.users where id=$1',[teacher]);
  for(const [table,column] of [['teacher_profiles','user_id'],['platform_lessons','teacher_id'],['platform_uploads','teacher_id'],['community_requests','user_id'],['community_supports','user_id'],['learner_progress','user_id'],['vision_clips','contributor_id'],['training_members','user_id']])
   expect((await one<{count:number}>(db,`select count(*)::int as count from ${table} where ${column}=$1`,[teacher]))!.count).toBe(0);
  expect((await one<{count:number}>(db,'select count(*)::int as count from platform_lesson_versions'))!.count).toBe(0);
  expect((await one<{count:number}>(db,"select count(*)::int as count from community_requests where id=$1",[requestId]))!.count).toBe(0);
  expect((await one<{support_count:number}>(db,'select support_count from community_requests where id=$1',[other]))!.support_count).toBe(0);
  expect((await one<{count:number}>(db,'select count(*)::int as count from waitlist'))!.count).toBe(0);
  expect((await one<{count:number}>(db,'select count(*)::int as count from training_organizations where id=$1',[solo]))!.count).toBe(0);
  // The shared organization keeps its module, without pointing at the deleted account.
  expect((await one<{created_by:string|null}>(db,'select created_by from training_modules where id=$1',[moduleId]))!.created_by).toBeNull();
  expect((await one<{email:string;status:string}>(db,"select email,status from training_members where organization_id=$1 and role='admin' and status='removed'",[shared]))!.email).toMatch(/^deleted-.+@account\.invalid$/);
  // History stays immutable outside account deletion.
  await expect(db.query('update training_module_versions set version=9')).rejects.toThrow('immutable');
 } finally { await db.close(); }
},60000);

it('asks a sole admin with other members to hand over first',async()=>{
 const db=await database();
 try {
  const admin='11111111-1111-4111-8111-111111111111',learner='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users(id) values($1),($2)',[admin,learner]);
  await db.exec('set role service_role;');
  const training=async(actor:string,email:string,payload:Record<string,unknown>)=>(await one<{result:any}>(db,'select public.training_mutate($1::uuid,$2,$3::jsonb) as result',[actor,email,JSON.stringify(payload)]))!.result;
  const {organizationId}=await training(admin,'admin@example.test',{action:'org.create',name:'School',kind:'school',plan:'up-to-25'});
  await training(admin,'admin@example.test',{action:'member.invite',organizationId,role:'learner',invites:[{email:'learner@example.test',tokenHash:'b'.repeat(64)}]});
  await expect(db.query('select public.account_delete($1,$2)',[admin,'admin@example.test'])).rejects.toThrow('sole_admin');
  expect((await one<{count:number}>(db,'select count(*)::int as count from training_members where user_id=$1',[admin]))!.count).toBe(1);
 } finally { await db.close(); }
},60000);
