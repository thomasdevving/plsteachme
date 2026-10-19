const access=vi.hoisted(()=>({cookieUser:vi.fn()}));
vi.mock('@/lib/auth/server',()=>({authenticatedUser:access.cookieUser}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({rpc:vi.fn(),insert:vi.fn(),tables:{} as Record<string,unknown>,counts:{} as Record<string,number>}));
vi.mock('server-only',()=>({}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:vi.fn()},rpc:state.rpc,from:(table:string)=>{
 const chain:Record<string,any>={};for(const method of ['select','eq','neq','in','order','limit','maybeSingle','single','delete','update'])chain[method]=()=>chain;
 chain.insert=(value:unknown)=>{state.insert(table,value);return chain;};
 chain.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:state.tables[table]??null,count:state.counts[table]??0,error:null}).then(resolve);return chain;
}})}));
import { GET, POST } from '../app/api/vision/route';
import { FEATURE_LENGTH, extractFeatures, hasHands, mirrorFeatures } from '../lib/vision/features';
import { createSmoother, evaluate, predict, rng, splitByClip, train, type Clip } from '../lib/vision/model';
import { builtinSteps, qualityGate, readPrediction, shadowAgrees, targetLabels } from '../lib/vision-contract';
import { trainTarget } from '../lib/vision-server';
import { createCoachSession } from '../lib/coaching-security';

const random=rng(3);
const hand=(cx:number,cy:number,spread:number,scale=1)=>Array.from({length:21},(_,i)=>({x:cx+scale*(Math.cos(i)*spread*(i%5)/10+(random()-.5)*.01),y:cy+scale*(Math.sin(i)*spread*(i%4)/10+(random()-.5)*.01)}));
const pose=Array.from({length:33},()=>({x:.5,y:.5}));pose[11]={x:.4,y:.6};pose[12]={x:.6,y:.6};
const shapes:Record<string,()=>{pose:typeof pose;hands:ReturnType<typeof hand>[]}>={other:()=>({pose,hands:[hand(.3+random()*.4,.5,.5)]}),s0:()=>({pose,hands:[hand(.4,.4,1),hand(.6,.4,1)]}),m0:()=>({pose,hands:[hand(.4,.7,.2),hand(.6,.7,.2)]})};
const dataset=(perLabel=4):Clip[]=>Object.keys(shapes).flatMap(label=>Array.from({length:perLabel},(_,c)=>({id:`${label}-${c}`,label,frames:Array.from({length:30},()=>extractFeatures(shapes[label]()))})));

describe('landmark features',()=>{
 it('are fixed length and ignore where the hands are and how close they are',()=>{
  const base=[{x:.4,y:.4},...Array.from({length:20},(_,i)=>({x:.4+(i%5)*.02,y:.4+Math.floor(i/5)*.03}))];
  const moved=base.map(point=>({x:point.x*.5+.2,y:point.y*.5+.1}));
  const a=extractFeatures({pose:[],hands:[base]}),b=extractFeatures({pose:[],hands:[moved]});
  expect(a).toHaveLength(FEATURE_LENGTH);
  expect(a.slice(1,43)).toEqual(b.slice(1,43));
 });
 it('mark missing hands and mirror reversibly',()=>{
  const empty=extractFeatures({pose:[],hands:[]});
  expect(hasHands(empty)).toBe(false);expect(empty.every(value=>value===0)).toBe(true);
  const two=extractFeatures(shapes.s0());
  expect(mirrorFeatures(mirrorFeatures(two))).toEqual(two);
  expect(mirrorFeatures(two)).not.toEqual(two);
 });
});

describe('specialized model',()=>{
 it('splits by whole clip, so no recording is in both training and testing',()=>{
  const {training,validation}=splitByClip(dataset());
  expect(validation.length).toBe(3);expect(training.length).toBe(9);
  expect(training.some(clip=>validation.some(held=>held.id===clip.id))).toBe(false);
  expect(new Set(validation.map(clip=>clip.label)).size).toBe(3);
 });
 it('learns to recognize step results and mistakes on unseen clips',()=>{
  const clips=dataset();const {training,validation}=splitByClip(clips);
  const model=train(training,['other','s0','m0']);
  const result=evaluate(model,validation,training.length);
  expect(result.macroF1).toBeGreaterThan(.9);expect(result.clipAccuracy).toBe(1);
  expect(result.confusion.flat().reduce((a,b)=>a+b,0)).toBe(validation.length*30);
  expect(qualityGate(result).passed).toBe(true);
  const probs=predict(model,mirrorFeatures(extractFeatures(shapes.m0())));
  expect(readPrediction(model.labels,probs).label).toBe('m0');
 });
 it('trains deterministically and keeps weights finite',()=>{
  const clips=dataset(3);const a=train(clips,['other','s0','m0']),b=train(clips,['other','s0','m0']);
  expect(a).toEqual(b);expect([...a.w1.flat(),...a.w2.flat(),...a.std].every(Number.isFinite)).toBe(true);expect(a.std.every(value=>value>0)).toBe(true);
 });
 it('smooths noisy frames and abstains when unsure',()=>{
  const smoother=createSmoother(2);smoother.push([1,0]);expect(smoother.push([0,1])[0]).toBeCloseTo(.7);
  expect(readPrediction(['other','s0'],[.55,.45])).toEqual({label:'uncertain',confidence:.55});
 });
 it('needs enough clips and reports a failed quality gate honestly',()=>{
  expect(()=>trainTarget(dataset(2),['other','s0','m0'])).toThrow('at least 3 clips');
  const clips=dataset(3).map(clip=>clip.label==='m0'?{...clip,label:'s0'}:clip);
  const noisy=[...clips,...dataset(3).filter(clip=>clip.label==='m0').map(clip=>({...clip,id:`x${clip.id}`,label:'other'}))];
  const result=trainTarget(noisy,['other','s0','m0']);
  expect(result.labels).toEqual(['other','s0']);
  expect(result.gate.passed).toBe(result.metrics.macroF1>=.8&&result.metrics.clipAccuracy>=.8&&result.metrics.perLabel.every(item=>item.recall>=.6));
 });
 it('scores shadow agreement only for decisive cloud verdicts',()=>{
  expect(shadowAgrees('s2',2,'looks_right')).toBe(true);expect(shadowAgrees('other',2,'looks_right')).toBe(false);
  expect(shadowAgrees('m2',2,'adjust')).toBe(true);expect(shadowAgrees('s2',2,'adjust')).toBe(false);expect(shadowAgrees('uncertain',2,'adjust')).toBe(false);
  expect(shadowAgrees('s2',2,'unclear')).toBeNull();
  const labels=targetLabels(builtinSteps('tie'));
  expect(labels[0].id).toBe('other');expect(labels.filter(item=>item.kind==='result')).toHaveLength(7);expect(labels.every(item=>/^(other|s\d+|m\d+)$/.test(item.id))).toBe(true);
 });
});

const staffId='11111111-1111-4111-8111-111111111111',teacherId='22222222-2222-4222-8222-222222222222',lessonId='33333333-3333-4333-8333-333333333333',modelId='44444444-4444-4444-8444-444444444444';
const lessonDocument={title:'Fold a towel',category:'independent-living',objective:'Fold a towel neatly.',materials:['Towel'],safety:['Dry surface'],prerequisites:[],alternatives:[],completionCheck:'Edges align.',steps:[{title:'Lay flat',instruction:'Lay it flat.',tip:'',check:'Corners visible',evidence:['Corners'],commonMistakes:['Folded corner'],uncertainty:'Show it all.',manualAlternative:'Check corners.',visuallyCheckable:true}]};
const frames=(count:number,withHands=true)=>Array.from({length:count},()=>withHands?extractFeatures(shapes.s0()):extractFeatures({pose,hands:[]}));
function post(body:unknown,headers:Record<string,string>={}){return new NextRequest('http://localhost:3100/api/vision',{method:'POST',headers:{origin:'http://localhost:3100','content-type':'application/json','x-forwarded-for':`test-${Math.random()}`,...headers},body:JSON.stringify(body)});}
const clip=(extra:Record<string,unknown>={})=>({action:'clip.add',target:'builtin:tie',label:'s0',source:'camera',frames:frames(20),consent:true,...extra});
beforeEach(()=>{
 vi.unstubAllEnvs();vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','private');vi.stubEnv('OPENAI_API_KEY','test-key');vi.stubEnv('VISION_LAB_EMAILS','staff@example.test');vi.stubEnv('PLATFORM_REVIEWER_IDS','');vi.clearAllMocks();
 access.cookieUser.mockResolvedValue({id:staffId,email:'staff@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',is_anonymous:false});
 state.tables={vision_clips:{id:'55555555-5555-4555-8555-555555555555'},platform_lessons:{id:lessonId,teacher_id:teacherId,document:lessonDocument,training_opt_in:false,published_version_id:null},vision_models:{id:modelId,target:'builtin:tie',status:'active'}};state.counts={};
 state.rpc.mockResolvedValue({data:{ok:true},error:null});
});

describe('vision API boundaries',()=>{
 it('lets staff add clips to built-in lessons and records consent with landmarks only',async()=>{
  const response=await POST(post(clip()));
  expect(response.status).toBe(200);
  const [table,row]=state.insert.mock.calls[0];
  expect(table).toBe('vision_clips');expect(row).toMatchObject({target:'builtin:tie',label:'s0',contributor_id:staffId,consent_version:'2026-10-20',hand_rate:1});
  expect(Object.keys(row)).not.toContain('image');
 });
 it('refuses non-staff on built-in lessons and teachers without training permission',async()=>{
  access.cookieUser.mockResolvedValue({id:teacherId,email:'teacher@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',is_anonymous:false});
  expect((await POST(post(clip()))).status).toBe(403);
  expect((await POST(post(clip({target:`lesson:${lessonId}`})))).status).toBe(403);
  (state.tables.platform_lessons as Record<string,unknown>).training_opt_in=true;
  expect((await POST(post(clip({target:`lesson:${lessonId}`})))).status).toBe(200);
  expect((await POST(post(clip({target:`lesson:${lessonId}`,label:'s3'})))).status).toBe(400);
  expect((await POST(post({action:'model.activate',target:`lesson:${lessonId}`,modelId}))).status).toBe(403);
 });
 it('validates consent, frame shape and visible hands before saving',async()=>{
  expect((await POST(post(clip({consent:false})))).status).toBe(400);
  expect((await POST(post(clip({frames:[[1,2,3]]})))).status).toBe(400);
  const response=await POST(post(clip({frames:frames(20,false)})));
  expect(response.status).toBe(400);expect((await response.json()).error).toBe('no_hands');
  expect((await POST(post(clip({label:'other',frames:frames(20,false)})))).status).toBe(200);
  state.counts.vision_clips=400;
  expect((await POST(post(clip()))).status).toBe(409);
 });
 it('records shadow comparisons only inside a consented coaching session',async()=>{
  const body={action:'shadow',modelId,step:0,predicted:'s0',confidence:.9,coachStatus:'looks_right'};
  expect((await POST(post(body))).status).toBe(401);
  const response=await POST(post(body,{cookie:`pt-coach=${createCoachSession()}`}));
  expect(response.status).toBe(200);
  expect(state.insert.mock.calls[0]).toEqual(['vision_shadow_checks',{model_id:modelId,step:0,predicted:'s0',confidence:.9,coach_status:'looks_right',agrees:true}]);
 });
 it('serves only the active model publicly, without dataset access',async()=>{
  state.tables.vision_models={id:modelId,target:'builtin:tie',version:2,model:{labels:['other','s0']},feature_version:1};
  const active=await GET(new NextRequest('http://localhost:3100/api/vision?view=active&target=builtin:tie'));
  expect((await active.json()).model).toMatchObject({id:modelId,version:2});
  access.cookieUser.mockResolvedValue(null);
  expect((await GET(new NextRequest('http://localhost:3100/api/vision?view=export&target=builtin:tie'))).status).toBe(401);
 });
});
