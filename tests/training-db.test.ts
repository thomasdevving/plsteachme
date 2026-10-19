import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const step=(title:string,extra:Record<string,unknown>={})=>({title,instruction:`Do ${title}`,tip:'',check:`${title} is visible`,evidence:['Visible result'],commonMistakes:[],uncertainty:'Show it closer',manualAlternative:'Inspect it yourself',visuallyCheckable:true,...extra});
const document={title:'Seal a box',category:'diy',objective:'Seal a shipping box securely',materials:['Tape'],safety:['Mind the cutter'],prerequisites:[],alternatives:[],completionCheck:'Box is sealed',steps:[step('Fold flaps'),step('Apply tape')]};

it('enforces organization roles, seats, invitations, assignments and server-verified progress in PostgreSQL',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261019120000_organization_training.sql',import.meta.url),'utf8'));
  const admin='11111111-1111-4111-8111-111111111111',learner='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333',second='44444444-4444-4444-8444-444444444444';
  await db.query('insert into auth.users(id) values($1),($2),($3),($4)',[admin,learner,outsider,second]);
  await db.exec('set role service_role;');
  const mutate=async(actor:string,email:string,payload:Record<string,unknown>)=>(await db.query<{result:Record<string,any>}>('select public.training_mutate($1::uuid,$2,$3::jsonb) as result',[actor,email,JSON.stringify(payload)])).rows[0].result;
  const hash=(n:number)=>n.toString(16).padStart(64,'f');

  const {organizationId}=await mutate(admin,'Admin@School.example',{action:'org.create',name:'Riverside College',kind:'school',plan:'up-to-25'});
  expect((await db.query<{email:string;role:string}>('select email,role from training_members where organization_id=$1',[organizationId])).rows[0]).toEqual({email:'admin@school.example',role:'admin'});
  await expect(mutate(outsider,'x@example.com',{action:'member.invite',organizationId,role:'learner',invites:[{email:'a@example.com',tokenHash:hash(1)}]})).rejects.toThrow('forbidden');

  // Seats: 25 learners fit, the 26th does not. Admins and instructors are free.
  const many=Array.from({length:25},(_,i)=>({email:`learner${i}@example.com`,tokenHash:(1000+i).toString(16).padStart(64,'0')}));
  many[0]={email:'learner@example.com',tokenHash:hash(1)};
  expect((await mutate(admin,'admin@school.example',{action:'member.invite',organizationId,role:'learner',invites:many})).added).toBe(25);
  await expect(mutate(admin,'admin@school.example',{action:'member.invite',organizationId,role:'learner',invites:[{email:'extra@example.com',tokenHash:hash(2)}]})).rejects.toThrow('seats');
  await mutate(admin,'admin@school.example',{action:'member.invite',organizationId,role:'instructor',invites:[{email:'coach@example.com',tokenHash:hash(3)}]});
  await expect(mutate(admin,'admin@school.example',{action:'org.plan',organizationId,plan:'up-to-25'})).resolves.toMatchObject({ok:true});
  await mutate(admin,'admin@school.example',{action:'org.plan',organizationId,plan:'up-to-75'});
  await mutate(admin,'admin@school.example',{action:'member.invite',organizationId,role:'learner',invites:[{email:'extra@example.com',tokenHash:hash(2)}]});
  await expect(mutate(admin,'admin@school.example',{action:'org.plan',organizationId,plan:'up-to-25'})).rejects.toThrow('seats');

  // Invitations are personal and single use.
  await expect(mutate(outsider,'someone@example.com',{action:'member.accept',tokenHash:hash(1)})).rejects.toThrow('forbidden');
  await mutate(learner,'Learner@Example.com',{action:'member.accept',tokenHash:hash(1)});
  await expect(mutate(learner,'learner@example.com',{action:'member.accept',tokenHash:hash(1)})).rejects.toThrow('not_found');
  await mutate(second,'extra@example.com',{action:'member.accept',tokenHash:hash(2)});
  await expect(mutate(learner,'learner@example.com',{action:'module.create',organizationId,source:'manual',document})).rejects.toThrow('forbidden');

  const {moduleId}=await mutate(admin,'admin@school.example',{action:'module.create',organizationId,source:'demonstration',document});
  const frame=`${organizationId}/${moduleId}/frames/55555555-5555-4555-8555-555555555555.jpg`;
  await expect(mutate(admin,'admin@school.example',{action:'module.save',moduleId,sourceText:'',document:{...document,steps:[step('Fold flaps',{reference:{frame,startSec:0,endSec:3,hands:2}})]}})).rejects.toThrow('forbidden');
  await expect(mutate(admin,'admin@school.example',{action:'module.moments',moduleId,moments:[{frame:`${organizationId}/66666666-6666-4666-8666-666666666666/frames/x.jpg`,at:3,kind:'hold',hands:2,caption:''}],uploads:[]})).rejects.toThrow('forbidden');
  await mutate(admin,'admin@school.example',{action:'module.moments',moduleId,moments:[{frame,at:3,kind:'hold',hands:2,caption:'Flaps folded'}],uploads:[{path:frame,size:2000}]});
  await mutate(admin,'admin@school.example',{action:'module.save',moduleId,sourceText:'Narration',document:{...document,steps:[step('Fold flaps',{reference:{frame,startSec:0,endSec:3,hands:2}}),step('Apply tape')]}});
  await expect(mutate(admin,'admin@school.example',{action:'module.registerUpload',moduleId,path:`${organizationId}/other/demos/a.webm`,kind:'demo',size:10,contentType:'video/webm'})).rejects.toThrow('forbidden');

  const learnerMember=(await db.query<{id:string}>('select id from training_members where user_id=$1',[learner])).rows[0].id;
  await expect(mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:1,step:0,results:['pending','pending'],completed:false})).rejects.toThrow('not_found');
  await mutate(admin,'admin@school.example',{action:'module.publish',moduleId,audience:'selected',memberIds:[learnerMember]});
  await expect(mutate(second,'extra@example.com',{action:'progress.save',moduleId,version:1,step:0,results:['pending','pending'],completed:false})).rejects.toThrow('forbidden');
  expect(await mutate(admin,'admin@school.example',{action:'progress.save',moduleId,version:1,step:0,results:['manual','pending'],completed:false})).toMatchObject({stored:false});

  // A browser claim of camera confirmation is downgraded until the server records one.
  expect((await mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:1,step:1,results:['visual','pending'],completed:false})).results).toEqual(['manual','pending']);
  await mutate(learner,'learner@example.com',{action:'progress.verify',moduleId,version:1,step:1});
  expect((await mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:1,step:1,results:['manual','visual'],completed:true})).results).toEqual(['manual','visual']);
  await expect(mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:1,step:1,results:['manual'],completed:true})).rejects.toThrow('conflict');
  await expect(mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:2,step:1,results:['manual','visual'],completed:true})).rejects.toThrow('conflict');
  const progress=(await db.query<{completed_at:string|null;completed_results:string[]}>('select completed_at,completed_results from training_progress where member_id=$1',[learnerMember])).rows[0];
  expect(progress.completed_at).not.toBeNull();expect(progress.completed_results).toEqual(['manual','visual']);

  // Republishing starts a fresh record for the new version; history is immutable.
  await mutate(admin,'admin@school.example',{action:'module.publish',moduleId,audience:'all',memberIds:[]});
  await mutate(second,'extra@example.com',{action:'progress.save',moduleId,version:2,step:0,results:['pending','pending'],completed:false});
  await mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:2,step:0,results:['visual','pending'],completed:false});
  expect((await db.query<{version:number;verified:number[]}>('select version,verified from training_progress where member_id=$1',[learnerMember])).rows[0]).toEqual({version:2,verified:[]});
  await expect(db.query('update training_module_versions set document=$1',[JSON.stringify(document)])).rejects.toThrow('permission denied');
  await db.exec('reset role;');
  await expect(db.query('update training_module_versions set document=$1',[JSON.stringify(document)])).rejects.toThrow('immutable');
  await db.exec('set role service_role;');

  // An organization always keeps an admin; removed learners lose access.
  const adminMember=(await db.query<{id:string}>('select id from training_members where user_id=$1',[admin])).rows[0].id;
  await expect(mutate(admin,'admin@school.example',{action:'member.remove',organizationId,memberId:adminMember})).rejects.toThrow('conflict');
  await expect(mutate(admin,'admin@school.example',{action:'member.update',organizationId,memberId:adminMember,role:'learner'})).rejects.toThrow('conflict');
  await mutate(admin,'admin@school.example',{action:'member.remove',organizationId,memberId:learnerMember});
  await expect(mutate(learner,'learner@example.com',{action:'progress.save',moduleId,version:2,step:0,results:['pending','pending'],completed:false})).rejects.toThrow('forbidden');
  await mutate(admin,'admin@school.example',{action:'module.archive',moduleId});
  await expect(mutate(second,'extra@example.com',{action:'progress.save',moduleId,version:2,step:0,results:['pending','pending'],completed:false})).rejects.toThrow('not_found');

  await db.exec('reset role;set role authenticated;');
  await expect(db.query('select * from training_progress')).rejects.toThrow('permission denied');
  await expect(mutate(admin,'admin@school.example',{action:'org.create',name:'Escalation',kind:'business',plan:'up-to-25'})).rejects.toThrow('permission denied');
 } finally { await db.close(); }
},30000);
