// @vitest-environment jsdom
// The browser side of voice coaching with a fake Web Call SDK. No real call is made.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const sdk=vi.hoisted(()=>({instances:[] as FakeCall[],fail:'' as string}));
type Handler=(value?:unknown)=>void;
class FakeCall {
 handlers=new Map<string,Handler[]>();stopped=0;muted=false;
 constructor(public options:{getSession:()=>Promise<unknown>}){sdk.instances.push(this);}
 on(event:string,handler:Handler){this.handlers.set(event,[...(this.handlers.get(event)??[]),handler]);}
 emit(event:string,value?:unknown){for(const handler of this.handlers.get(event)??[])handler(value);}
 async start(){try{await this.options.getSession();}catch(error){this.emit('error',{code:'mint_failed',message:String(error)});throw error;}if(sdk.fail){this.emit('error',{code:sdk.fail,message:sdk.fail});throw new Error(sdk.fail);}this.emit('call-start');}
 async stop(){this.stopped++;}
 setMuted(value:boolean){this.muted=value;}
}
vi.mock('@bolna/web-call',()=>({BolnaWebCall:FakeCall}));
import { VoiceCoach } from '../components/voice-coach';
import { decideVoiceCommand } from '../lib/voice/client';
import { advanceLessonProgress, emptyLessonProgress, recordCheckpoint } from '../lib/learning-progress';

const id='44444444-4444-4444-8444-444444444444',token='browser-token-not-real-0000';
const command=(action:string,revision=1,step=0)=>({id:`55555555-5555-4555-8555-55555555555${['next','pause','stop','back','resume'].indexOf(action)+1}`,action,revision,step});
let polls:unknown[]=[];let available=true;let startStatus=200;
const fetcher=vi.fn();
const calls=(method:string,fragment:string)=>fetcher.mock.calls.filter(([url,init])=>(fragment.endsWith('/session')?String(url)===fragment:String(url).includes(fragment))&&((init as RequestInit|undefined)?.method??'GET')===method);
const bodies=(method:string,fragment:string)=>calls(method,fragment).map(([,init])=>JSON.parse(String((init as RequestInit).body)));
let revision=1;
beforeEach(()=>{
 vi.stubGlobal('React',React);sdk.instances=[];sdk.fail='';polls=[];available=true;startStatus=200;revision=1;
 Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))},configurable:true});
 fetcher.mockReset();
 fetcher.mockImplementation(async(url:string,init?:RequestInit)=>{
  const method=init?.method??'GET';
  if(url==='/api/voice/session'&&method==='GET')return Response.json({available,maxCallSeconds:300});
  if(url==='/api/voice/session')return startStatus===200?Response.json({session:{run_id:'run-0000000001',agent_id:'agent',sip_username:'u',sip_password:'p',sip_domain:'d',wss_url:'wss://d/ws',sip_register:false,expires_in:120,ice_servers:[]},voice:{id,token,step:0,revision:1,maxSeconds:300,remainingSeconds:600,events:true}}):Response.json({error:startStatus===403?'allowance':'busy',remainingSeconds:0},{status:startStatus});
  if(url.endsWith('/ack')){const body=JSON.parse(String(init!.body));if(body.applied)revision++;return Response.json({result:body.applied?'applied':'declined',revision,step:body.step??0});}
  if(method==='GET')return Response.json(polls.shift()??{status:'active',step:0,revision,commands:[]});
  if(method==='PUT'){revision++;return Response.json({revision,step:JSON.parse(String(init!.body)).step,status:'active'});}
  return Response.json({stopped:true});
 });
 vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

function setup(overrides:Partial<React.ComponentProps<typeof VoiceCoach>>={}) {
 const props={skill:'tie' as const,step:0,completed:false,onAction:vi.fn(()=>({applied:true,step:1})),onSessionChange:vi.fn(),onPausedChange:vi.fn(),...overrides};
 const view=render(<VoiceCoach {...props}/>);
 return {props,view};
}
async function begin(clicks=1) {
 const startButton=await screen.findByRole('button',{name:'Start voice coaching'});
 await waitFor(()=>expect(screen.getByText(/sends your microphone audio to Bolna/)).toBeTruthy());
 const age=screen.getByLabelText('I am 16 or older.') as HTMLInputElement,agree=screen.getByLabelText(/I agree to send my voice to Bolna/) as HTMLInputElement;
 if(!age.checked){
  expect((startButton as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(age);fireEvent.click(agree);
 }
 expect((startButton as HTMLButtonElement).disabled).toBe(false);
 await act(async()=>{for(let i=0;i<clicks;i++)fireEvent.click(startButton);});
}

describe('voice coach in the lesson',()=>{
 it('explains the audio processing, needs consent, and shows a clear unavailable state',async()=>{
  available=false;
  setup();
  expect(await screen.findByText(/Voice coaching isn’t connected yet/)).toBeTruthy();
  expect((screen.getByRole('button',{name:'Start voice coaching'}) as HTMLButtonElement).disabled).toBe(true);
  expect(calls('POST','/api/voice/session')).toHaveLength(0);
 });
 it('asks for the microphone before reserving minutes, and explains a denial',async()=>{
  (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error('denied'),{name:'NotAllowedError'}));
  setup();await begin();
  expect(await screen.findByText(/Microphone access was blocked/)).toBeTruthy();
  expect(calls('POST','/api/voice/session')).toHaveLength(0);
  expect(sdk.instances).toHaveLength(0);
 });
 it('applies a spoken next once through the lesson rules and acknowledges it',async()=>{
  polls=[{status:'active',step:0,revision:1,commands:[command('next')]}];
  const {props}=setup();await begin(2);
  expect(await screen.findByText('Listening')).toBeTruthy();
  expect(props.onSessionChange).toHaveBeenCalledWith({id,token});
  await waitFor(()=>expect(bodies('POST','/ack')).toHaveLength(1),{timeout:5000});
  expect(props.onAction).toHaveBeenCalledTimes(1);expect(props.onAction).toHaveBeenCalledWith('next');
  expect(bodies('POST','/ack')[0]).toEqual({commandId:command('next').id,applied:true,step:1});
  // Two quick clicks never start two calls.
  expect(sdk.instances).toHaveLength(1);expect(calls('POST','/api/voice/session')).toHaveLength(1);
 });
 it('declines commands for an outdated revision or step without touching the lesson',async()=>{
  polls=[{status:'active',step:0,revision:1,commands:[command('next',1,3)]}];
  const {props}=setup();await begin();
  await waitFor(()=>expect(bodies('POST','/ack')).toHaveLength(1),{timeout:5000});
  expect(props.onAction).not.toHaveBeenCalled();
  expect(bodies('POST','/ack')[0]).toMatchObject({applied:false,step:null});
 });
 it('a spoken pause pauses camera checks too, and stop ends the call and the session',async()=>{
  polls=[{status:'active',step:0,revision:1,commands:[command('pause')]},{status:'paused',step:0,revision:2,commands:[command('stop',2)]}];
  const {props}=setup();await begin();
  await waitFor(()=>expect(props.onPausedChange).toHaveBeenCalledWith(true),{timeout:5000});
  expect(await screen.findByText('Voice coaching paused')).toBeTruthy();
  await waitFor(()=>expect(sdk.instances[0].stopped).toBe(1),{timeout:5000});
  expect(bodies('DELETE',`/api/voice/session/${id}`)).toEqual([{reason:'stopped'}]);
  expect(props.onSessionChange).toHaveBeenLastCalledWith(null);
  expect(props.onPausedChange).toHaveBeenLastCalledWith(false);
  expect(props.onAction).not.toHaveBeenCalled();
  expect(await screen.findByText(/Voice coaching stopped. Your microphone is off./)).toBeTruthy();
 });
 it('the visible controls mute, pause and stop immediately',async()=>{
  const {props}=setup();await begin();
  fireEvent.click(await screen.findByRole('button',{name:'Mute'}));
  expect(sdk.instances[0].muted).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Pause'}));
  expect(props.onPausedChange).toHaveBeenLastCalledWith(true);
  await waitFor(()=>expect(bodies('PUT',`/api/voice/session/${id}`)).toContainEqual({step:0,restart:false,paused:true}));
  fireEvent.click(screen.getByRole('button',{name:'Stop voice'}));
  expect(sdk.instances[0].stopped).toBe(1);
  expect(bodies('DELETE',`/api/voice/session/${id}`)).toEqual([{reason:'stopped'}]);
  expect(screen.getByRole('button',{name:'Start voice coaching'})).toBeTruthy();
 });
 it('stops when the page is hidden, on navigation and when the lesson is complete',async()=>{
  const first=setup();await begin();await screen.findByText('Listening');
  Object.defineProperty(document,'hidden',{value:true,configurable:true});
  act(()=>{document.dispatchEvent(new Event('visibilitychange'));});
  Object.defineProperty(document,'hidden',{value:false,configurable:true});
  expect(sdk.instances[0].stopped).toBe(1);
  expect(bodies('DELETE',`/api/voice/session/${id}`)).toEqual([{reason:'hidden'}]);
  await begin();await screen.findByText('Listening');
  first.view.rerender(<VoiceCoach {...first.props} step={6} completed/>);
  expect(await screen.findByText('Lesson complete. Voice coaching has ended.')).toBeTruthy();
  expect(bodies('DELETE',`/api/voice/session/${id}`).at(-1)).toEqual({reason:'completed'});
  first.view.unmount();
  const second=setup();await begin();await screen.findByText('Listening');
  second.view.unmount();
  expect(sdk.instances.at(-1)!.stopped).toBe(1);
  expect(bodies('DELETE',`/api/voice/session/${id}`).at(-1)).toEqual({reason:'navigation'});
 });
 it('reports manual navigation so older spoken commands go stale',async()=>{
  const {props,view}=setup();await begin();await screen.findByText('Listening');
  view.rerender(<VoiceCoach {...props} step={2}/>);
  await waitFor(()=>expect(bodies('PUT',`/api/voice/session/${id}`)).toContainEqual({step:2,restart:false,paused:null}));
 });
 it('shows failed connections and start limits in plain language',async()=>{
  sdk.fail='connect_failed';
  setup();await begin();
  expect(await screen.findByText(/could not connect/)).toBeTruthy();
  expect(bodies('DELETE',`/api/voice/session/${id}`)).toEqual([{reason:'failed'}]);
  cleanup();sdk.fail='';startStatus=403;
  setup();await begin();
  expect(await screen.findByText(/You have used your voice coaching minutes/)).toBeTruthy();
  startStatus=409;cleanup();
  setup();await begin();
  expect(await screen.findByText(/already running in another tab/)).toBeTruthy();
 });
});

describe('spoken next and checkpoint rules',()=>{
 it('records a self-check, never a camera confirmation, and keeps an existing confirmation',()=>{
  const fresh=emptyLessonProgress('tie');
  const next=advanceLessonProgress(fresh,7,true)!;
  expect(next.step).toBe(1);expect(next.checkpoints[0]).toBe('self_checked');
  expect(next.checkpoints).not.toContain('camera_confirmed');
  const confirmed=recordCheckpoint(fresh,0,'camera_confirmed');
  expect(advanceLessonProgress(confirmed,7,true)!.checkpoints[0]).toBe('camera_confirmed');
  // Without a self-check (automatic advance), only a camera confirmation moves on.
  expect(advanceLessonProgress(fresh,7,false)).toBeNull();
  const last={...fresh,step:6};
  expect(advanceLessonProgress(last,7,true)).toMatchObject({step:6,completed:true});
 });
 it('applies a command only for the revision and step it was made for',()=>{
  const next={id:'66666666-6666-4666-8666-666666666666',action:'next' as const,revision:4,step:2};
  expect(decideVoiceCommand(next,{revision:4,step:2,completed:false})).toBe('apply');
  expect(decideVoiceCommand(next,{revision:5,step:2,completed:false})).toBe('stale');
  expect(decideVoiceCommand(next,{revision:4,step:3,completed:false})).toBe('stale');
  expect(decideVoiceCommand(next,{revision:4,step:2,completed:true})).toBe('decline');
  expect(decideVoiceCommand({...next,action:'stop'},{revision:4,step:2,completed:true})).toBe('apply');
 });
});
