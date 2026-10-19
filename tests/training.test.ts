const access=vi.hoisted(()=>({cookieUser:vi.fn()}));
vi.mock('@/lib/auth/server',()=>({authenticatedUser:access.cookieUser}));
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
const state=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),upload:vi.fn(),download:vi.fn(),ai:vi.fn(),tables:{} as Record<string,unknown>}));
vi.mock('server-only',()=>({}));
vi.mock('ai',()=>({generateText:state.ai,transcribe:vi.fn(),Output:{object:(value:unknown)=>value}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:state.user},rpc:state.rpc,from:(table:string)=>{
 const chain:Record<string,any>={};for(const method of ['select','eq','neq','not','is','in','order','limit','maybeSingle','single'])chain[method]=()=>chain;
 chain.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:state.tables[table]??null,error:null}).then(resolve);return chain;
},storage:{from:()=>({upload:state.upload,download:state.download,createSignedUrls:async(paths:string[])=>({data:paths.map(path=>({path,signedUrl:`https://example.test/${path}`})),error:null})})}})}));
import { GET, POST } from '../app/api/training/route';
import { applyDraft, planForLearners, referenceFor, stepsFromMoments, stripReferences, trainingActionSchema, trainingDocumentSchema, type TrainingDocument, type TrainingMoment } from '../lib/training-contract';
import { createSegmenter, summarizeHands } from '../lib/vision/demonstration-tracking';
import { trainingAccessAllowed } from '../lib/training-server';

const orgId='11111111-1111-4111-8111-111111111111',moduleId='22222222-2222-4222-8222-222222222222',userId='33333333-3333-4333-8333-333333333333',memberId='44444444-4444-4444-8444-444444444444';
const frame=(n:number)=>`${orgId}/${moduleId}/frames/5555555${n}-5555-4555-8555-555555555555.jpg`;
const step={title:'Fold flaps',instruction:'Fold the short flaps first.',tip:'',check:'Short flaps are folded.',evidence:['Flaps lie flat'],commonMistakes:[],uncertainty:'Show the box from above.',manualAlternative:'Press each flap flat.',visuallyCheckable:true};
const document:TrainingDocument={title:'Seal a box',category:'diy',objective:'Seal a shipping box securely.',materials:['Tape'],safety:['Keep fingers clear of the cutter.'],prerequisites:[],alternatives:[],completionCheck:'The box is sealed.',steps:[{...step,reference:{frame:frame(1),startSec:0,endSec:4,hands:2}},{...step,title:'Tape seam',visuallyCheckable:false}]};
const moments:TrainingMoment[]=[{frame:frame(1),at:4,kind:'hold',hands:2,caption:'Folded'},{frame:frame(2),at:9.5,kind:'marker',hands:1,caption:'Taped'}];

describe('demonstration tracking',()=>{
 const hand=(x:number,y:number)=>[{x,y},{x:x+.05,y:y+.05}];
 function run(path:(t:number)=>number|null,seconds:number){const segmenter=createSegmenter();const events=[];for(let t=0;t<=seconds;t+=.1){const x=path(t);const event=segmenter.push(t,summarizeHands(x===null?[]:[hand(x,.5)]));if(event)events.push(event);}return events;}
 it('captures a moment when the hands hold still after working',()=>{
  const events=run(t=>t<1?.2:t<3?.2+(t-1)*.2:.6,6);
  expect(events).toHaveLength(1);expect(events[0].at).toBeGreaterThan(3.8);expect(events[0].at).toBeLessThan(4.6);expect(events[0].hands).toBe(1);
 });
 it('captures each step of a multi-step demonstration',()=>{
  const events=run(t=>t<2?.2+t*.15:t<4?.5:t<6?.5-(t-4)*.15:.2,9);
  expect(events).toHaveLength(2);
 });
 it('ignores jitter, brief fidgets and hands that leave the frame',()=>{
  expect(run(t=>.5+Math.sin(t*20)*.002,6)).toHaveLength(0);
  expect(run(t=>t>1&&t<1.4?.5+(t-1)*.4:.5,6)).toHaveLength(0);
  expect(run(t=>t<2?.2+t*.2:null,6)).toHaveLength(0);
 });
 it('summarizes hand positions within the frame',()=>{
  expect(summarizeHands([])).toEqual({count:0,center:null,box:null});
  const summary=summarizeHands([[{x:.2,y:.2}],[{x:.6,y:1.4}]]);
  expect(summary.count).toBe(2);expect(summary.box?.x).toBeCloseTo(.2);expect(summary.box?.w).toBeCloseTo(.4);expect(summary.box?.h).toBeCloseTo(.8);expect(summary.center?.y).toBeCloseTo(.6);
 });
});

describe('training contract',()=>{
 it('maps learner counts to the $100–$500 plans',()=>{
  expect(planForLearners(1)?.monthly).toBe(100);expect(planForLearners(25)?.monthly).toBe(100);expect(planForLearners(26)?.monthly).toBe(200);expect(planForLearners(150)?.monthly).toBe(350);expect(planForLearners(300)?.monthly).toBe(500);expect(planForLearners(301)).toBeNull();
 });
 it('builds referenced steps from key moments and from AI choices',()=>{
  const built=stepsFromMoments(moments);
  expect(built.map(item=>item.reference)).toEqual([{frame:frame(1),startSec:0,endSec:4,hands:2},{frame:frame(2),startSec:4,endSec:9.5,hands:1}]);
  const drafted=applyDraft({document:stripReferences(document),stepMoments:[1,1],verify:[]},moments);
  expect(drafted.steps[0].reference?.frame).toBe(frame(2));expect(drafted.steps[1].reference).toBeUndefined();
  expect(applyDraft({document:stripReferences(document),stepMoments:[7,-1],verify:[]},moments).steps.every(item=>!item.reference)).toBe(true);
  expect(referenceFor(moments,5)).toBeUndefined();
 });
 it('only accepts server-shaped still paths and bounded inputs',()=>{
  expect(trainingDocumentSchema.safeParse(document).success).toBe(true);
  for(const bad of ['../secret.jpg',`${orgId}/${moduleId}/demos/55555551-5555-4555-8555-555555555555.jpg`,'https://example.test/a.jpg'])expect(trainingDocumentSchema.safeParse({...document,steps:[{...step,reference:{frame:bad,startSec:0,endSec:1,hands:1}}]}).success).toBe(false);
  expect(trainingActionSchema.safeParse({action:'member.invite',organizationId:orgId,role:'owner',emails:['a@example.test']}).success).toBe(false);
  expect(trainingActionSchema.safeParse({action:'member.invite',organizationId:orgId,role:'learner',emails:Array.from({length:101},(_,i)=>`a${i}@example.test`)}).success).toBe(false);
  expect(trainingActionSchema.safeParse({action:'module.generate',moduleId,focus:''}).success).toBe(false);
  expect(trainingActionSchema.safeParse({action:'progress.verify',moduleId,version:1,step:0}).success).toBe(false);
  expect(trainingActionSchema.safeParse({action:'module.publish',moduleId,audience:'all',memberIds:[]}).success).toBe(false);
 });
});

let jpeg:string;
beforeAll(async()=>{jpeg=`data:image/jpeg;base64,${(await sharp({create:{width:40,height:40,channels:3,background:'white'}}).jpeg().toBuffer()).toString('base64')}`;});
beforeEach(()=>{
 vi.unstubAllEnvs();vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','private-service-key');vi.stubEnv('OPENAI_API_KEY','test-key');vi.stubEnv('TRAINING_ACCESS_EMAILS','admin@school.example');vi.clearAllMocks();
 access.cookieUser.mockResolvedValue({id:userId,email:'Admin@School.example',email_confirmed_at:'2026-10-01T00:00:00Z',is_anonymous:false});
 state.rpc.mockResolvedValue({data:{ok:true},error:null});state.upload.mockResolvedValue({data:{},error:null});state.download.mockResolvedValue({data:new Blob([Buffer.from('reference')]),error:null});
 state.tables={training_modules:{id:moduleId,organization_id:orgId,audience:'all',published_version_id:'66666666-6666-4666-8666-666666666666',document,moments,source:'demonstration',source_text:'',manual_path:null},training_members:{id:memberId,role:'learner'},training_module_versions:{id:'66666666-6666-4666-8666-666666666666',version:2,document,demo_path:null},training_assignments:null};
 state.ai.mockResolvedValue({output:{status:'looks_right',confidence:'high',observation:'The flaps lie flat.',guidance:'Keep going.'}});
});
function post(body:unknown,headers:Record<string,string>={}) {return new NextRequest('http://localhost:3100/api/training',{method:'POST',headers:{origin:'http://localhost:3100','content-type':'application/json','x-forwarded-for':`test-${Math.random()}`,...headers},body:JSON.stringify(body)});}
const coach=(extra:Record<string,unknown>={})=>({action:'module.coach',moduleId,version:2,step:0,frames:[jpeg],consent:true,over16:true,...extra});

describe('training API boundaries',()=>{
 it('rejects cross-origin, unconfigured and signed-out requests',async()=>{
  expect((await POST(post({action:'member.accept',token:'a'.repeat(32)},{origin:'https://attacker.test'}))).status).toBe(403);
  access.cookieUser.mockResolvedValue(null);expect((await POST(post({action:'member.accept',token:'a'.repeat(32)}))).status).toBe(401);
  vi.stubEnv('SUPABASE_URL','');expect((await POST(post({action:'member.accept',token:'a'.repeat(32)}))).status).toBe(503);
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('opens the workspace only to allowlisted, verified emails',async()=>{
  const confirmed='2026-10-01T00:00:00Z';
  delete process.env.TRAINING_ACCESS_EMAILS;
  expect(trainingAccessAllowed({email:'Thomastheconguyen@gmail.com',email_confirmed_at:confirmed})).toBe(true);
  expect(trainingAccessAllowed({email:'admin@school.example',email_confirmed_at:confirmed})).toBe(false);
  expect(trainingAccessAllowed({email:'thomastheconguyen@gmail.com',email_confirmed_at:null})).toBe(false);
  vi.stubEnv('TRAINING_ACCESS_EMAILS','admin@school.example');
  access.cookieUser.mockResolvedValue({id:userId,email:'someone@example.test',email_confirmed_at:confirmed,is_anonymous:false});
  const denied=await POST(post({action:'org.create',name:'Riverside',kind:'school',plan:'up-to-25'}));
  expect(denied.status).toBe(403);expect((await denied.json()).error).toBe('restricted');
  expect((await GET(new NextRequest('http://localhost:3100/api/training?view=me'))).status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
  access.cookieUser.mockResolvedValue({id:userId,email:'Admin@School.example',email_confirmed_at:confirmed,is_anonymous:false});
  expect((await POST(post({action:'org.create',name:'Riverside',kind:'school',plan:'up-to-25'}))).status).toBe(200);
  expect(state.rpc.mock.calls[0][1]).toMatchObject({actor_id:userId,actor_email:'admin@school.example'});
 });
 it('stores only invitation hashes and returns each link once',async()=>{
  state.rpc.mockResolvedValue({data:{ok:true,added:1,skipped:['b@example.test']},error:null});
  const response=await POST(post({action:'member.invite',organizationId:orgId,role:'learner',emails:['A@example.test','b@example.test','a@example.test']}));
  const body=await response.json();
  expect(body.invites).toHaveLength(1);expect(body.invites[0].link).toMatch(/^http:\/\/localhost:3100\/training\?invite=[A-Za-z0-9_-]{32}$/);
  const token=body.invites[0].link.split('=')[1];const payload=JSON.stringify(state.rpc.mock.calls[0][1]);
  expect(payload).not.toContain(token);expect(state.rpc.mock.calls[0][1].payload.invites).toHaveLength(2);
 });
 it('maps full seats to a clear conflict',async()=>{
  state.rpc.mockResolvedValue({data:null,error:{message:'seats'}});
  const response=await POST(post({action:'member.invite',organizationId:orgId,role:'learner',emails:['a@example.test']}));
  expect(response.status).toBe(409);expect((await response.json()).message).toContain('seats');
 });
 it('coaches against the instructor reference and records confirmations on the server',async()=>{
  const response=await POST(post(coach()));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({id:moduleId,version:2,step:0,feedback:{status:'looks_right'}});
  const content=state.ai.mock.calls[0][0].messages[0].content;
  expect(content.some((part:{text?:string})=>part.text?.startsWith('REFERENCE'))).toBe(true);expect(content.filter((part:{type:string})=>part.type==='image')).toHaveLength(2);
  expect(JSON.stringify(content[0])).not.toContain('frames/');
  expect(state.ai.mock.calls[0][0]).toMatchObject({maxRetries:0,providerOptions:{openai:{store:false}}});
  expect(state.rpc.mock.calls[0][1].payload).toEqual({action:'progress.verify',moduleId,version:2,step:0});
 });
 it('never verifies nonvisual steps, stale versions or unassigned learners',async()=>{
  expect(await (await POST(post(coach({step:1})))).json()).toMatchObject({feedback:{status:'not_verifiable'}});
  expect(state.rpc).not.toHaveBeenCalled();
  expect((await POST(post(coach({version:1})))).status).toBe(409);
  (state.tables.training_modules as Record<string,unknown>).audience='selected';
  expect((await POST(post(coach()))).status).toBe(403);
  expect(state.ai).toHaveBeenCalledTimes(1);
 });
 it('requires consent and a source before generating, and keeps the module title',async()=>{
  expect((await POST(post({action:'module.generate',moduleId,focus:''}))).status).toBe(400);
  state.tables.training_members={id:memberId,role:'learner'};
  expect((await POST(post({action:'module.generate',moduleId,focus:'',aiConsent:true}))).status).toBe(403);
  state.tables.training_members={id:memberId,role:'instructor'};
  state.ai.mockResolvedValue({output:{document:{...stripReferences(document),title:'Something else'},stepMoments:[1,0],verify:['Confirm tape width']}});
  const response=await POST(post({action:'module.generate',moduleId,focus:'',aiConsent:true}));
  const body=await response.json();
  expect(response.status).toBe(200);expect(body.document.title).toBe('Seal a box');expect(body.document.steps[0].reference.frame).toBe(frame(2));expect(body.verify).toEqual(['Confirm tape width']);
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('re-encodes key moments into scoped private paths',async()=>{
  state.tables.training_members={id:memberId,role:'admin'};
  const response=await POST(post({action:'module.moments',moduleId,moments:[{frame:jpeg,at:3,kind:'hold',hands:2,caption:'Folded'}]}));
  expect(response.status).toBe(200);
  expect(state.upload.mock.calls[0][0]).toMatch(new RegExp(`^${orgId}/${moduleId}/frames/[a-f0-9-]{36}\\.jpg$`));expect(state.upload.mock.calls[0][1]).toBeInstanceOf(Buffer);
  expect(state.rpc.mock.calls[0][1].payload.moments[0]).toMatchObject({frame:state.upload.mock.calls[0][0],caption:'Folded'});
  expect((await POST(post({action:'module.moments',moduleId,moments:[{frame:'data:image/jpeg;base64,AAAA',at:3,kind:'hold',hands:2,caption:''}]}))).status).toBe(400);
 });
});
