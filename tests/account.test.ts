const access=vi.hoisted(()=>({cookieUser:vi.fn(),signOut:vi.fn()}));
vi.mock('@/lib/auth/server',()=>({authenticatedUser:access.cookieUser,authClient:async()=>({auth:{signOut:access.signOut}})}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({rpc:vi.fn(),insert:vi.fn(),remove:vi.fn(),deleteUser:vi.fn(),rows:[] as unknown[]}));
vi.mock('server-only',()=>({}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{admin:{deleteUser:state.deleteUser}},rpc:state.rpc,from:()=>{
 const chain:Record<string,any>={};for(const method of ['select','eq','limit'])chain[method]=()=>chain;
 chain.insert=(rows:unknown)=>{state.insert(rows);return Promise.resolve({error:null});};
 chain.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:state.rows,error:null}).then(resolve);return chain;
},storage:{from:(bucket:string)=>({remove:(paths:string[])=>state.remove(bucket,paths)})}})}));
import * as progress from '../app/api/progress/route';
import * as insights from '../app/api/insights/route';
import * as account from '../app/api/account/route';
import * as retention from '../app/api/maintenance/retention/route';
import { recordCoachVerdict } from '../lib/account-server';

const userId='33333333-3333-4333-8333-333333333333',session='77777777-7777-4777-8777-777777777777',lesson='published:22222222-2222-4222-8222-222222222222:v3';
const learner={id:userId,email:'learner@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',is_anonymous:false};
function request(path:string,body?:unknown,headers:Record<string,string>={}) {
 return new NextRequest(`http://localhost:3100${path}`,body===undefined?{headers}:{method:'POST',headers:{origin:'http://localhost:3100','content-type':'application/json','x-forwarded-for':`test-${Math.random()}`,...headers},body:JSON.stringify(body)});
}
beforeEach(()=>{
 vi.unstubAllEnvs();vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','private-service-key');vi.stubEnv('VISION_LAB_EMAILS','staff@example.test');vi.clearAllMocks();
 access.cookieUser.mockResolvedValue(learner);access.signOut.mockResolvedValue({});
 state.rows=[];state.rpc.mockResolvedValue({data:null,error:null});state.remove.mockResolvedValue({error:null});state.deleteUser.mockResolvedValue({error:null});
});

describe('account progress',()=>{
 it('lists and saves progress for the signed-in account only',async()=>{
  state.rows=[{lesson_key:'builtin:shoelaces',data:{step:2},client_updated_at:'1700000000000'}];
  expect(await (await progress.GET()).json()).toEqual({progress:[{lessonKey:'builtin:shoelaces',data:{step:2},updatedAt:1700000000000}]});
  state.rpc.mockResolvedValue({data:{lessonKey:lesson,data:{step:1},updatedAt:5},error:null});
  expect((await progress.POST(request('/api/progress',{lessonKey:lesson,data:{step:1},updatedAt:5}))).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith('progress_save',{p_user:userId,p_key:lesson,p_data:{step:1},p_updated:5});
 });
 it('rejects signed-out, cross-origin, malformed and oversized saves',async()=>{
  for(const bad of [{lessonKey:'builtin:../x',data:{},updatedAt:1},{lessonKey:lesson,data:{},updatedAt:-1},{lessonKey:lesson,data:{},updatedAt:1,extra:true}])expect((await progress.POST(request('/api/progress',bad))).status).toBe(400);
  expect((await progress.POST(request('/api/progress',{lessonKey:lesson,data:{},updatedAt:1},{origin:'https://attacker.test'}))).status).toBe(403);
  expect((await progress.POST(request('/api/progress',{lessonKey:lesson,data:'x'.repeat(17000),updatedAt:1}))).status).toBe(413);
  access.cookieUser.mockResolvedValue({...learner,is_anonymous:true});
  expect((await progress.GET()).status).toBe(401);
  expect(state.rpc).not.toHaveBeenCalled();
 });
});

describe('learning insights',()=>{
 it('stores anonymous events without account data',async()=>{
  const events=[{lessonKey:'builtin:shoelaces',kind:'lesson_start'},{lessonKey:'builtin:shoelaces',kind:'step',step:0,result:'camera_confirmed'}];
  expect((await insights.POST(request('/api/insights',{sessionId:session,events}))).status).toBe(200);
  expect(state.insert).toHaveBeenCalledWith([{session_id:session,lesson_key:'builtin:shoelaces',kind:'lesson_start',step:null,result:''},{session_id:session,lesson_key:'builtin:shoelaces',kind:'step',step:0,result:'camera_confirmed'}]);
  expect(access.cookieUser).not.toHaveBeenCalled();
  expect((await insights.POST(request('/api/insights',{sessionId:session,events:[{lessonKey:'builtin:shoelaces',kind:'coach'}]}))).status).toBe(400);
 });
 it('records coach verdicts and drops a malformed session header',async()=>{
  await recordCoachVerdict(new Request('http://localhost:3100',{headers:{'x-learning-session':session}}),'builtin:tie',2,'looks_right');
  await recordCoachVerdict(new Request('http://localhost:3100',{headers:{'x-learning-session':'not-a-session'}}),'builtin:tie',2,'adjust');
  expect(state.insert.mock.calls.map(call=>call[0])).toEqual([{session_id:session,lesson_key:'builtin:tie',kind:'coach',step:2,result:'looks_right'},{session_id:null,lesson_key:'builtin:tie',kind:'coach',step:2,result:'adjust'}]);
 });
 it('shows the overview to staff only',async()=>{
  expect((await insights.GET(request('/api/insights?days=30'))).status).toBe(403);
  access.cookieUser.mockResolvedValue({...learner,email:'staff@example.test'});
  state.rpc.mockResolvedValue({data:{learners:3,lessons:[]},error:null});
  expect(await (await insights.GET(request('/api/insights?days=7'))).json()).toEqual({insights:{learners:3,lessons:[]}});
  expect(state.rpc.mock.calls[0][0]).toBe('learning_insights');
 });
});

describe('account deletion',()=>{
 it('needs the typed confirmation',async()=>{
  expect((await account.POST(request('/api/account',{action:'delete',confirm:'yes'}))).status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('deletes records, stored files and the sign-in account',async()=>{
  state.rpc.mockResolvedValue({data:{demoPaths:['a/demo.mp4'],trainingPaths:['b/c/manuals/d.pdf']},error:null});
  const response=await account.POST(request('/api/account',{action:'delete',confirm:'delete my account'}));
  expect(await response.json()).toEqual({deleted:true});
  expect(state.rpc).toHaveBeenCalledWith('account_delete',{p_user:userId,p_email:'learner@example.test'});
  expect(state.remove.mock.calls).toEqual([['teacher-demonstrations',['a/demo.mp4']],['organization-training',['b/c/manuals/d.pdf']],['profile-avatars',[`${userId}/avatar.jpg`]]]);
  expect(access.signOut).toHaveBeenCalled();expect(state.deleteUser).toHaveBeenCalledWith(userId);
 });
 it('explains when an organization would lose its only admin',async()=>{
  state.rpc.mockResolvedValue({data:null,error:{message:'sole_admin'}});
  const response=await account.POST(request('/api/account',{action:'delete',confirm:'delete my account'}));
  expect(response.status).toBe(409);expect(state.deleteUser).not.toHaveBeenCalled();
 });
});

describe('retention cleanup',()=>{
 it('runs only with the maintenance secret',async()=>{
  const run=(auth?:string)=>retention.POST(new Request('http://localhost:3100/api/maintenance/retention',{method:'POST',headers:auth?{authorization:auth}:{}}));
  expect((await run('Bearer whatever')).status).toBe(503);
  vi.stubEnv('MAINTENANCE_SECRET','s'.repeat(32));
  expect((await run()).status).toBe(401);expect((await run(`Bearer ${'t'.repeat(32)}`)).status).toBe(401);
  expect(state.rpc).not.toHaveBeenCalled();
  state.rpc.mockResolvedValue({data:{demoPaths:['old/demo.mp4'],trainingPaths:[],reports:2,events:10,shadowChecks:0},error:null});
  expect(await (await run(`Bearer ${'s'.repeat(32)}`)).json()).toEqual({ok:true,removed:{teacherVideos:1,organizationFiles:0,reports:2,events:10,shadowChecks:0}});
  expect(state.remove).toHaveBeenCalledWith('teacher-demonstrations',['old/demo.mp4']);
 });
});
