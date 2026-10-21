// Voice coaching routes against the real SQL functions (PGlite). Only Bolna's HTTP API is
// replaced, by a controlled fake: these tests do not prove a live Bolna call works.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const pg=vi.hoisted(()=>({db:null as unknown as import('@electric-sql/pglite').PGlite}));
const access=vi.hoisted(()=>({trialAccess:vi.fn(),requireTrial:vi.fn()}));
const ai=vi.hoisted(()=>({generateText:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/trial',()=>access);
vi.mock('@/lib/auth/config',()=>({authConfig:()=>({enabled:true,url:'http://supabase.test',key:'sb_publishable_test'})}));
vi.mock('@/lib/account-server',()=>({recordCoachVerdict:vi.fn()}));
vi.mock('ai',()=>({generateText:ai.generateText,Output:{object:(options:unknown)=>options}}));
vi.mock('@/lib/storage',async()=>{
 const {createHash,randomBytes}=await import('node:crypto');
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  try {
   const keys=Object.keys(args);
   const result=await pg.db.query<{v:unknown}>(`select public.${name}(${keys.map((key,i)=>`${key} => $${i+1}`).join(', ')}) as v`,keys.map(key=>args[key]!==null&&typeof args[key]==='object'?JSON.stringify(args[key]):args[key]));
   return {data:result.rows[0].v,error:null};
  } catch(error) { return {data:null,error}; }
 };
 return {mockMode:false,db:()=>({rpc}),hash:(value:string)=>createHash('sha256').update(value).digest('hex'),token:()=>randomBytes(24).toString('base64url'),record:vi.fn(),under16Count:vi.fn()};
});
import { GET as availability, POST as start } from '../app/api/voice/session/route';
import { GET as poll, PUT as setState, DELETE as stop } from '../app/api/voice/session/[id]/route';
import { POST as ack } from '../app/api/voice/session/[id]/ack/route';
import { POST as tool } from '../app/api/voice/tools/[tool]/route';
import { POST as webhook } from '../app/api/voice/webhook/route';
import { POST as cameraCheck } from '../app/api/coaching/check/route';
import { createCoachSession } from '../lib/coaching-security';
import { modules } from '../lib/modules';
import { buildAgentConfig, EXAMPLE_INPUT, TOOL_NAMES } from '../lib/voice/agent-config';

const learner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const trial={id:'33333333-3333-4333-8333-333333333333',skill_id:'tie-four-in-hand',total_steps:7,completed_steps:0,completed_at:null,started_at:''};
const TOOL_SECRET='t'.repeat(32),WEBHOOK_SECRET='w'.repeat(32),API='https://api.bolna.ai';
const origin='http://localhost:3100';
let runCounter=0;
const bolna=vi.fn();
let mint:{status:number;body?:unknown}={status:200};
let execution:{status:string;conversation_duration:number|null}={status:'completed',conversation_duration:95};

function minted(){return {run_id:`run-${String(++runCounter).padStart(10,'0')}`,agent_id:'agent-test',sip_username:'u',sip_password:'p',sip_domain:'sip.bolna.test',wss_url:'wss://sip.bolna.test/ws',sip_register:false,expires_in:120,ice_servers:[{urls:'turn:turn.bolna.test',username:'x',credential:'y'}]};}
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key, email text); create function auth.uid() returns uuid language sql as 'select null::uuid'; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 const folder=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(folder)).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[learner,other]);
 return db;
}
const json=(body:unknown)=>({'content-type':'application/json',body:JSON.stringify(body)});
function startRequest(body:unknown={skill:'tie',step:0,consent:true,over16:true}){const {body:payload,...headers}=json(body);return new NextRequest(`${origin}/api/voice/session`,{method:'POST',headers:{origin,...headers,'x-forwarded-for':`test-${Math.random()}`,'x-coaching-session':trial.id},body:payload});}
function browser(method:string,id:string,token:string,body?:unknown,path=''){return new NextRequest(`${origin}/api/voice/session/${id}${path}`,{method,headers:{origin,'x-voice-token':token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const ctx=(id:string)=>({params:Promise.resolve({id})});
function callTool(name:string,body:unknown,{auth=`Bearer ${TOOL_SECRET}`,ip='13.203.39.153'}={}){return tool(new NextRequest(`${origin}/api/voice/tools/${name}`,{method:'POST',headers:{'content-type':'application/json',authorization:auth,'cf-connecting-ip':ip},body:JSON.stringify(body)}),{params:Promise.resolve({tool:name})});}
function hook(body:unknown,secret=WEBHOOK_SECRET){return webhook(new NextRequest(`${origin}/api/voice/webhook`,{method:'POST',headers:{'content-type':'application/json','x-plsteach-webhook-secret':secret,'cf-connecting-ip':'13.126.9.249'},body:JSON.stringify(body)}));}
const bolnaCalls=(fragment:string)=>bolna.mock.calls.filter(([url])=>String(url).includes(fragment));
const events=()=>bolnaCalls('/events').map(([,init])=>JSON.parse(String((init as RequestInit).body)));

/** Starts a voice session for the learner; returns the browser keys and the tool keys Bolna would hold. */
async function started(){
 const response=await start(startRequest());
 expect(response.status).toBe(200);
 const data=await response.json();
 const userData=JSON.parse(String((bolnaCalls('/web-call/')[bolnaCalls('/web-call/').length-1][1] as RequestInit).body)).user_data;
 return {id:data.voice.id as string,token:data.voice.token as string,toolKeys:{voice_session:userData.voice_session as string,voice_token:userData.voice_token as string},data,userData};
}

beforeEach(async()=>{
 vi.unstubAllEnvs();vi.clearAllMocks();
 for(const [key,value] of Object.entries({BOLNA_API_KEY:'bn-test-key-not-real',BOLNA_AGENT_ID:'agent-test',BOLNA_TOOL_SECRET:TOOL_SECRET,BOLNA_WEBHOOK_SECRET:WEBHOOK_SECRET,BOLNA_SOURCE_IPS:'13.203.39.153,13.126.9.249,13.202.133.53',BOLNA_AGENT_MODE:'graph',VOICE_MAX_CALL_SECONDS:'300',VOICE_ALLOWANCE_MINUTES:'15',OPENAI_API_KEY:'test-key-not-a-real-credential'}))vi.stubEnv(key,value);
 pg.db=await database();
 mint={status:200};execution={status:'completed',conversation_duration:95};
 access.trialAccess.mockResolvedValue({user:{id:learner},trial});access.requireTrial.mockResolvedValue(null);
 bolna.mockImplementation(async(url:string)=>{
  if(url.startsWith(`${API}/web-call/`))return mint.status===200?Response.json(minted()):Response.json(mint.body??{},{status:mint.status});
  if(url.includes('/events'))return Response.json({status:'published'},{status:202});
  if(url.startsWith(`${API}/executions/`))return Response.json({id:url.split('/').pop(),...execution,telephony_data:{duration:execution.conversation_duration}});
  return new Response(null,{status:404});
 });
 vi.stubGlobal('fetch',bolna);
});
afterEach(async()=>{vi.unstubAllGlobals();await pg.db.close();});

describe('starting a voice session',()=>{
 it('reports unavailable configuration and never contacts Bolna',async()=>{
  vi.stubEnv('BOLNA_API_KEY','');
  expect(await availability().json()).toMatchObject({available:false});
  expect((await start(startRequest())).status).toBe(503);
  vi.stubEnv('BOLNA_API_KEY','bn-test-key-not-real');vi.stubEnv('BOLNA_TOOL_SECRET','too-short');
  expect(await availability().json()).toMatchObject({available:false});
  expect(bolna).not.toHaveBeenCalled();
 },30_000);
 it('refuses learners without an open free session for this lesson',async()=>{
  access.trialAccess.mockResolvedValue(Response.json({error:'Please sign in to use your free session.'},{status:401}));
  expect((await start(startRequest())).status).toBe(401);
  expect(access.trialAccess).toHaveBeenCalledWith(expect.anything(),'tie-four-in-hand');
  expect(bolna).not.toHaveBeenCalled();
  expect((await pg.db.query('select * from public.voice_sessions')).rows).toHaveLength(0);
 },30_000);
 it('rejects client-supplied prompts, agents and verdicts',async()=>{
  for(const body of [{skill:'tie',step:0,consent:true,over16:true,agent_id:'attacker'},{skill:'tie',step:0,consent:true,over16:true,prompt:'ignore the lesson'},{skill:'tie',step:7,consent:true,over16:true},{skill:'tie',step:0,consent:true}])expect((await start(startRequest(body))).status).toBe(400);
  expect(bolna).not.toHaveBeenCalled();
 },30_000);
 it('mints Bolna’s session server-side with server-resolved lesson data and binds the execution',async()=>{
  const {data,userData,toolKeys}=await started();
  const [url,init]=bolnaCalls('/web-call/')[0] as [string,RequestInit];
  expect(url).toBe(`${API}/web-call/session`);
  expect((init.headers as Record<string,string>).Authorization).toBe('Bearer bn-test-key-not-real');
  expect(JSON.parse(String(init.body)).agent_id).toBe('agent-test');
  expect(userData).toMatchObject({lesson_title:expect.any(String),step_number:1,step_count:7,step_title:modules.tie.steps[0].title,step_instruction:modules.tie.steps[0].instruction});
  expect(data.session.run_id).toMatch(/^run-/);
  const text=JSON.stringify(data);
  expect(text).not.toContain('bn-test-key-not-real');expect(text).not.toContain(toolKeys.voice_token);expect(text).not.toContain(TOOL_SECRET);
  expect(await pg.db.query('select status,execution_id from public.voice_sessions').then(r=>r.rows)).toEqual([{status:'active',execution_id:data.session.run_id}]);
 },30_000);
 it('falls back to the earlier mint path when the current one is not found',async()=>{
  bolna.mockImplementation(async(url:string)=>url===`${API}/web-call/session`?new Response(null,{status:404}):url===`${API}/web-call/freeswitch-session`?Response.json(minted()):new Response(null,{status:404}));
  expect((await start(startRequest())).status).toBe(200);
 },30_000);
 it('refunds the reservation when Bolna is at capacity or fails, and shows the right error',async()=>{
  mint={status:429,body:{scope:'customer'}};
  const busy=await start(startRequest());
  expect(busy.status).toBe(429);expect(await busy.json()).toEqual({error:'at_capacity',scope:'customer'});
  mint={status:500};
  expect((await start(startRequest())).status).toBe(502);
  mint={status:200,body:{run_id:'bad'}};bolna.mockImplementationOnce(async()=>Response.json({unexpected:true}));
  expect((await start(startRequest())).status).toBe(502);
  expect((await pg.db.query('select reserved_seconds,used_seconds from public.voice_allowances')).rows).toEqual([{reserved_seconds:0,used_seconds:0}]);
 },30_000);
 it('prevents a second simultaneous session and enforces the voice-minute allowance',async()=>{
  vi.stubEnv('VOICE_ALLOWANCE_MINUTES','8');
  const first=await started();
  expect((await start(startRequest())).status).toBe(409);
  await stop(browser('DELETE',first.id,first.token,{reason:'stopped'}),ctx(first.id));
  // Not yet reconciled: the first call's five minutes stay reserved, three remain.
  const limited=await start(startRequest());
  expect(limited.status).toBe(403);expect(await limited.json()).toEqual({error:'allowance',remainingSeconds:180});
  expect(bolnaCalls('/web-call/')).toHaveLength(1);
 },30_000);
});

describe('session access boundaries',()=>{
 it('keeps another learner and other tokens out of a session',async()=>{
  const mine=await started();
  await pg.db.query("update public.voice_sessions set status='ended' where id=$1",[mine.id]);
  access.trialAccess.mockResolvedValue({user:{id:other},trial});
  const theirs=await started();
  for(const [id,token] of [[mine.id,theirs.token],[theirs.id,mine.token],[mine.id,'x'.repeat(32)]] as const){
   expect((await poll(browser('GET',id,token),ctx(id))).status).toBe(404);
   expect((await setState(browser('PUT',id,token,{step:1,restart:false,paused:null}),ctx(id))).status).toBe(404);
  }
  expect((await poll(browser('GET',mine.id,''),ctx(mine.id))).status).toBe(401);
  // Tool calls need the session's own tool token, which Bolna holds and the browser never sees.
  expect((await callTool('get_current_step',{voice_session:theirs.id,voice_token:mine.toolKeys.voice_token})).status).toBe(401);
  expect((await callTool('get_current_step',{voice_session:theirs.id,voice_token:theirs.token})).status).toBe(401);
  expect((await callTool('get_current_step',theirs.toolKeys)).status).toBe(200);
  expect((await poll(new NextRequest(`${origin}/api/voice/session/${theirs.id}`,{headers:{origin:'https://attacker.example','x-voice-token':theirs.token}}),ctx(theirs.id))).status).toBe(403);
 },30_000);
 it('authenticates tool calls with the agent secret and Bolna’s source IPs',async()=>{
  const {toolKeys}=await started();
  expect((await callTool('get_current_step',toolKeys,{auth:'Bearer wrong-secret-wrong-secret-wrong'})).status).toBe(401);
  expect((await callTool('get_current_step',toolKeys,{auth:''})).status).toBe(401);
  expect((await callTool('get_current_step',toolKeys,{ip:'198.51.100.7'})).status).toBe(401);
  expect((await callTool('delete_everything',toolKeys)).status).toBe(404);
  expect((await callTool('request_lesson_action',{...toolKeys,action:'confirm_camera',step_number:1})).status).toBe(400);
 },30_000);
});

describe('tools, commands and lesson state',()=>{
 it('answers from server lesson content and queues each spoken action once',async()=>{
  const {id,token,toolKeys}=await started();
  const current=await (await callTool('get_current_step',toolKeys)).json();
  expect(current).toMatchObject({step_number:1,title:modules.tie.steps[0].title,instruction:modules.tie.steps[0].instruction,camera_can_confirm:true,coaching:'active'});
  const first=await (await callTool('request_lesson_action',{...toolKeys,action:'next',step_number:1})).json();
  const retry=await (await callTool('request_lesson_action',{...toolKeys,action:'next',step_number:'1'})).json();
  expect(first).toMatchObject({accepted:true,duplicate:false});expect(retry).toMatchObject({accepted:true,duplicate:true});
  expect(first.message).toContain('never a camera confirmation');
  const polled=await (await poll(browser('GET',id,token),ctx(id))).json();
  expect(polled.commands).toHaveLength(1);
  const command=polled.commands[0];
  const applied=await (await ack(browser('POST',id,token,{commandId:command.id,applied:true,step:1},'/ack'),ctx(id))).json();
  expect(applied).toMatchObject({result:'applied',step:1,revision:2});
  // Acknowledging again cannot apply it twice.
  expect(await (await ack(browser('POST',id,token,{commandId:command.id,applied:true,step:2},'/ack'),ctx(id))).json()).toMatchObject({result:'duplicate',step:1});
  // The Graph Agent is told about the new step; that the event was accepted does not mean it was spoken.
  expect(events()).toEqual([{event:'step_changed',properties:expect.objectContaining({step_number:2,step_title:modules.tie.steps[1].title})}]);
  // The agent still thinks step 1 is on screen.
  expect(await (await callTool('request_lesson_action',{...toolKeys,action:'next',step_number:1})).json()).toMatchObject({accepted:false,reason:'step_changed',current_step_number:2});
 },30_000);
 it('stops pending spoken actions when the learner navigates with the buttons',async()=>{
  const {id,token,toolKeys}=await started();
  await callTool('request_lesson_action',{...toolKeys,action:'next',step_number:1});
  const pending=(await (await poll(browser('GET',id,token),ctx(id))).json()).commands[0];
  expect(await (await setState(browser('PUT',id,token,{step:2,restart:false,paused:null}),ctx(id))).json()).toMatchObject({step:2,status:'active'});
  expect(await (await ack(browser('POST',id,token,{commandId:pending.id,applied:true,step:1},'/ack'),ctx(id))).json()).toMatchObject({result:'stale',step:2});
  expect((await (await poll(browser('GET',id,token),ctx(id))).json()).commands).toEqual([]);
 },30_000);
 it('pause and stop end the relevant activity, not only the agent’s speech',async()=>{
  const {id,token,toolKeys}=await started();
  await callTool('request_lesson_action',{...toolKeys,action:'pause',step_number:1});
  const pause=(await (await poll(browser('GET',id,token),ctx(id))).json()).commands[0];
  expect(await (await ack(browser('POST',id,token,{commandId:pause.id,applied:true,step:null},'/ack'),ctx(id))).json()).toMatchObject({result:'applied'});
  expect(await (await poll(browser('GET',id,token),ctx(id))).json()).toMatchObject({status:'paused'});
  expect(await (await callTool('request_lesson_action',{...toolKeys,action:'next',step_number:1})).json()).toMatchObject({accepted:false,reason:'paused'});
  expect(await (await callTool('get_current_step',toolKeys)).json()).toMatchObject({coaching:'paused'});
  expect((await stop(browser('DELETE',id,token,{reason:'stopped'}),ctx(id))).status).toBe(200);
  expect(await (await poll(browser('GET',id,token),ctx(id))).json()).toMatchObject({status:'ended',end_reason:'stopped'});
  expect(await (await callTool('get_current_step',toolKeys)).json()).toMatchObject({available:false});
 },30_000);
 it('ends sessions at the maximum call duration',async()=>{
  vi.stubEnv('VOICE_MAX_CALL_SECONDS','100000');
  const {id,token,toolKeys,data}=await started();
  // Out-of-range values fall back to the five-minute default instead of an unbounded call.
  expect(data.voice.maxSeconds).toBe(300);
  expect(await pg.db.query<{s:number}>("select extract(epoch from expires_at-created_at)::int s from public.voice_sessions").then(r=>r.rows[0].s)).toBe(390);
  expect(buildAgentConfig({appUrl:'https://plsteach.me',toolSecret:TOOL_SECRET,webhookSecret:WEBHOOK_SECRET,maxCallSeconds:300,mode:'graph'}).agent_config.tasks[0].task_config.call_terminate).toBe(300);
  await pg.db.query("update public.voice_sessions set expires_at=now()-interval '1 second'");
  expect(await (await callTool('request_lesson_action',{...toolKeys,action:'next',step_number:1})).json()).toMatchObject({available:false});
  expect(await (await poll(browser('GET',id,token),ctx(id))).json()).toMatchObject({status:'ended',end_reason:'expired'});
 },30_000);
});

describe('camera results reach the coach only from the server',()=>{
 let frame='';
 beforeEach(async()=>{const sharp=(await import('sharp')).default;frame=`data:image/jpeg;base64,${(await sharp({create:{width:64,height:48,channels:3,background:'#ddbb99'}}).jpeg().toBuffer()).toString('base64')}`;});
 const check=(step:number,keys:{id:string;token:string})=>cameraCheck(new NextRequest(`${origin}/api/coaching/check`,{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':`test-${Math.random()}`,cookie:`pt-coach=${createCoachSession()}`,'x-voice-session':keys.id,'x-voice-token':keys.token},body:JSON.stringify({skill:'tie',step,frames:[frame]})}));
 it('records a fresh verified assessment once, announces it once, and rejects stale ones',async()=>{
  const keys=await started();
  ai.generateText.mockResolvedValue({output:{status:'adjust',confidence:'high',observation:'The wide end is shorter than the narrow end.',guidance:'Lower the wide end until it hangs below the narrow end.'}});
  expect((await check(0,keys)).status).toBe(200);
  expect((await check(0,keys)).status).toBe(200);
  expect(events().filter(event=>event.event==='camera_result')).toEqual([{event:'camera_result',properties:{camera_step_number:1,camera_result:'adjust',camera_observation:'The wide end is shorter than the narrow end.',camera_guidance:'Lower the wide end until it hangs below the narrow end.'}}]);
  const latest=await (await callTool('get_latest_observation',keys.toolKeys)).json();
  expect(latest).toMatchObject({available:true,result:'adjust',observation:'The wide end is shorter than the narrow end.'});
  expect(latest.wording).toContain('not live video');
  // A different result for the same step is announced; a low-confidence one only reaches the screen.
  ai.generateText.mockResolvedValue({output:{status:'looks_right',confidence:'medium',observation:'Maybe fine.',guidance:'Hold still.'}});
  await check(0,keys);
  expect(events().filter(event=>event.event==='camera_result')).toHaveLength(1);
  // An observation goes stale with age.
  await pg.db.query("update public.voice_sessions set observed_at=now()-interval '2 minutes'");
  expect(await (await callTool('get_latest_observation',keys.toolKeys)).json()).toMatchObject({available:false,reason:'no_recent_check'});
  // After navigation, a check result for the earlier step is not recorded.
  await setState(browser('PUT',keys.id,keys.token,{step:1,restart:false,paused:null}),ctx(keys.id));
  ai.generateText.mockResolvedValue({output:{status:'looks_right',confidence:'high',observation:'The wide end hangs lower.',guidance:'Keep both ends flat.'}});
  await check(0,keys);
  expect(await (await callTool('get_latest_observation',keys.toolKeys)).json()).toMatchObject({available:false,step_number:2});
  expect(events().filter(event=>event.event==='camera_result')).toHaveLength(1);
 },30_000);
 it('does not record checks while coaching is paused, and tools mode publishes no events',async()=>{
  vi.stubEnv('BOLNA_AGENT_MODE','tools');
  const keys=await started();
  ai.generateText.mockResolvedValue({output:{status:'adjust',confidence:'high',observation:'The narrow end is in front.',guidance:'Cross the wide end over the narrow end.'}});
  await setState(browser('PUT',keys.id,keys.token,{step:0,restart:false,paused:true}),ctx(keys.id));
  await check(0,keys);
  expect(await (await callTool('get_latest_observation',keys.toolKeys)).json()).toMatchObject({available:false});
  await setState(browser('PUT',keys.id,keys.token,{step:0,restart:false,paused:false}),ctx(keys.id));
  await check(0,keys);
  expect(await (await callTool('get_latest_observation',keys.toolKeys)).json()).toMatchObject({available:true,result:'adjust'});
  expect(events()).toEqual([]);
 },30_000);
});

describe('usage reconciliation webhooks',()=>{
 it('authenticates, deduplicates and reconciles from the trusted execution record',async()=>{
  const {data}=await started();
  const id=data.session.run_id;
  const delivery={id,status:'completed',updated_at:'2026-10-21T10:00:00Z',conversation_duration:1,transcript:'assistant: hi'};
  expect((await hook(delivery,'wrong-secret-wrong-secret-wrong')).status).toBe(401);
  expect(await (await hook({...delivery,status:'in-progress'})).json()).toMatchObject({ignored:true});
  expect(await (await hook(delivery)).json()).toMatchObject({ok:true,result:'ok'});
  expect(await (await hook(delivery)).json()).toMatchObject({duplicate:true});
  expect(bolnaCalls('/executions/')).toHaveLength(1);
  // The payload claimed 1 second; the execution record says 95.
  expect((await pg.db.query('select reserved_seconds,used_seconds from public.voice_allowances')).rows).toEqual([{reserved_seconds:0,used_seconds:95}]);
  expect(await (await hook({...delivery,updated_at:'2026-10-21T10:00:05Z'})).json()).toMatchObject({result:'duplicate'});
  expect(JSON.stringify((await pg.db.query('select * from public.voice_sessions')).rows)).not.toContain('assistant: hi');
 },30_000);
 it('lets Bolna retry when the execution record is not final or cannot be read',async()=>{
  const {data}=await started();
  const delivery={id:data.session.run_id,status:'completed'};
  execution={status:'call-disconnected',conversation_duration:null};
  expect(await (await hook(delivery)).json()).toMatchObject({pending:true});
  bolna.mockImplementationOnce(async()=>new Response(null,{status:500}));
  expect((await hook(delivery)).status).toBe(503);
  execution={status:'completed',conversation_duration:42};
  expect(await (await hook(delivery)).json()).toMatchObject({result:'ok'});
 },30_000);
});

it('keeps the agent tools and parameter mappings consistent with the tool routes',()=>{
 for(const mode of ['graph','tools'] as const){
  const config=buildAgentConfig({appUrl:'https://plsteach.me/',toolSecret:TOOL_SECRET,webhookSecret:WEBHOOK_SECRET,maxCallSeconds:300,mode});
  const tools=config.agent_config.tasks[0].tools_config.api_tools;
  expect(tools.tools.map(item=>item.name)).toEqual([...TOOL_NAMES]);
  for(const item of tools.tools){
   expect(item.key).toBe('custom_task');
   const params=tools.tools_params[item.name];
   expect(params.url).toBe(`https://plsteach.me/api/voice/tools/${item.name}`);
   expect(Object.keys(params.param).sort()).toEqual(Object.keys(item.parameters.properties).sort());
   expect(params.headers.Authorization).toBe(`Bearer ${TOOL_SECRET}`);
  }
 }
});
it('keeps the versioned example agent configurations in sync with the builder',async()=>{
 for(const mode of ['graph','tools'] as const)expect(JSON.parse(await readFile(new URL(`../bolna/agent.${mode}.example.json`,import.meta.url),'utf8'))).toEqual(buildAgentConfig({...EXAMPLE_INPUT,mode}));
});
