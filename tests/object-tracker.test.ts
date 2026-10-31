import { describe, expect, it } from 'vitest';
import { colorBin, enroll, initialState, scoreBox, track, type Box, type Frame } from '../lib/vision/object-tracker';
import { rng } from '../lib/vision/model';

const W=160,H=120;
type Shape={x:number;y:number;w:number;h:number;contains?:(dx:number,dy:number)=>boolean;paint:(dx:number,dy:number)=>[number,number,number]};
const stripes=(dx:number,dy:number):[number,number,number]=>Math.floor(dy/4)%2?[210,40,35]:[235,200,40];
const green=():[number,number,number]=>[40,170,60];
function frame(shapes:Shape[],seed=1,light=1):Frame{
 const random=rng(seed);const data=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let color:[number,number,number]=[90+random()*20,100+random()*20,120+random()*20];
  for(const shape of shapes)if(x>=shape.x&&x<shape.x+shape.w&&y>=shape.y&&y<shape.y+shape.h&&(!shape.contains||shape.contains(x-shape.x,y-shape.y)))color=shape.paint(x-shape.x,y-shape.y);
  const i=(y*W+x)*4;data[i]=color[0]*light;data[i+1]=color[1]*light;data[i+2]=color[2]*light;data[i+3]=255;
 }
 return {width:W,height:H,data};
}
const object=(x:number,y:number):Shape=>({x,y,w:24,h:32,paint:stripes});
const iou=(a:Box,b:Box)=>{const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return w*h/(a.w*a.h+b.w*b.h-w*h);};
const guide:Box={x:62,y:40,w:36,h:44};
const model=()=>enroll([0,1,2,3,4].map(seed=>frame([object(68+seed%2,46)],seed)),guide);

describe('few-shot object tracking',()=>{
 it('separates colors from grays in a lighting-robust way',()=>{
  expect(colorBin(200,30,30)).toBe(colorBin(120,18,18));
  expect(colorBin(128,128,128)).not.toBe(colorBin(200,30,30));
 });
 it('scores the enrolled object far above empty background or a different object',()=>{
  const learned=model();const scene=frame([object(20,20),{x:110,y:70,w:24,h:32,paint:green}],9);
  const onObject=scoreBox(scene,learned,{x:14,y:14,w:36,h:44});
  expect(onObject).toBeGreaterThan(.5);
  expect(scoreBox(scene,learned,{x:104,y:64,w:36,h:44})).toBeLessThan(.25);
  expect(scoreBox(scene,learned,{x:60,y:60,w:36,h:44})).toBeLessThan(.25);
 });
 it('rejects objects with the same colors but a different pattern or silhouette',()=>{
  const learned=model();
  const impostors:Shape[]=[
   {x:68,y:46,w:24,h:32,paint:()=>[210,40,35]},
   {x:68,y:46,w:24,h:32,paint:(dx)=>Math.floor(dx/4)%2?[210,40,35]:[235,200,40]},
   {x:40,y:20,w:80,h:80,paint:stripes},
  ];
  for(const impostor of impostors){
   const result=track(frame([impostor],40),learned,initialState());
   expect(result.status).toBe('searching');expect(result.box).toBeNull();
   const selected=track(frame([object(68,46)],41),learned,initialState());
   expect(track(frame([impostor],42),learned,selected).status).toBe('searching');
  }
 });
 it('does not keep a tracking box on a same-color replacement during the missed-frame grace period',()=>{
  const learned=model();const selected=track(frame([object(68,46)],7),learned,initialState());
  expect(selected.status).toBe('tracking');
  const replaced=track(frame([{x:68,y:46,w:24,h:32,paint:()=>[210,40,35]}],8),learned,selected);
  expect(replaced.status).toBe('searching');
 });
 it('declines featureless enrollment instead of accepting any patch with the same color',()=>{
  const solid:Shape={x:0,y:0,w:W,h:H,paint:()=>[210,40,35]};
  const flat=enroll([frame([solid])],guide);
  const result=track(frame([{x:25,y:25,w:40,h:50,paint:()=>[210,40,35]}],2),flat,initialState());
  expect(result.status).toBe('searching');expect(result.box).toBeNull();
 });
 it('uses the silhouette of a plain tie instead of accepting a same-color rectangle',()=>{
  const tie=(x:number,y:number):Shape=>({x,y,w:20,h:48,paint:()=>[190,55,45],contains:(dx,dy)=>{
   const half=dy<36?2+dy/6:(48-dy)*8/12;
   return Math.abs(dx-10)<half;
  }});
  const area={x:60,y:30,w:32,h:60};
  const learned=enroll([frame([tie(66,36)],1),frame([tie(66,36)],2)],area);
  const genuine=track(frame([tie(26,30)],4),learned,initialState());
  expect(genuine.status).toBe('tracking');expect(iou(genuine.box!,{x:26,y:30,w:20,h:48})).toBeGreaterThan(.25);
  const rectangle=frame([{x:26,y:30,w:20,h:48,paint:()=>[190,55,45]}],5);
  expect(track(rectangle,learned,initialState()).status).toBe('searching');
  expect(track(rectangle,learned,genuine).status).toBe('searching');
 });
 it('does not arbitrarily pick one of two visually identical candidates',()=>{
  const result=track(frame([object(20,40),object(110,40)],20),model(),initialState());
  expect(result.status).toBe('searching');expect(result.box).toBeNull();
 });
 it('keeps the selected object when a different object shares its color palette',()=>{
  const learned=model();let state=track(frame([object(28,40)],30),learned,initialState());
  for(let step=0;step<6;step++){
   const x=28+step*4;
   const scene=frame([object(x,40),{x:110,y:40,w:24,h:32,paint:dx=>Math.floor(dx/4)%2?[210,40,35]:[235,200,40]}],31+step);
   state=track(scene,learned,state);
   if(state.status==='tracking')expect(iou(state.box!,{x,y:40,w:24,h:32})).toBeGreaterThan(.3);
  }
 });
 it('follows the object as it moves, including under dimmer light',()=>{
  const learned=model();let state=initialState();
  for(let step=0;step<20;step++){
   const x=20+step*5,y=30+Math.round(Math.sin(step/3)*10);
   state=track(frame([object(x,y)],100+step,step>10?.7:1),learned,state);
   expect(state.status).toBe('tracking');
   expect(iou(state.box!,{x,y,w:24,h:32})).toBeGreaterThan(.3);
  }
 });
 it('keeps following a tie through turning, bending and changes in size',()=>{
  const tie=(cx:number,cy:number,angle:number,scale=1,bend=0):Shape=>{
   const c=Math.cos(angle),s=Math.sin(angle),w=(Math.abs(c)*20+Math.abs(s)*48)*scale,h=(Math.abs(s)*20+Math.abs(c)*48)*scale;
   const source=(dx:number,dy:number)=>{const x=(dx-w/2)/scale,y=(dy-h/2)/scale;return {u:x*c+y*s+10,v:-x*s+y*c+24};};
   return {x:cx-w/2,y:cy-h/2,w,h,paint:()=>[190,55,45],contains:(dx,dy)=>{const {u,v}=source(dx,dy);const half=v<36?2+v/6:(48-v)*8/12;return v>=0&&v<48&&Math.abs(u-10-bend*Math.sin(v/48*Math.PI))<half;}};
  };
  const learned=enroll([frame([tie(76,60,0)])],{x:60,y:30,w:32,h:60});
  let state=track(frame([tie(76,60,0)]),learned,initialState());
  expect(state.status).toBe('tracking');
  for(let i=1;i<=6;i++){
   const shape=tie(76+i*3,60-i, i*Math.PI/60,1+i*.025, i*.2);
   state=track(frame([shape],500+i),learned,state);
   expect(state.status,`movement frame ${i}`).toBe('tracking');
   expect(iou(state.box!,shape)).toBeGreaterThan(.25);
  }
 });
 it('keeps a temporary anchor through brief occlusion, then resumes without enrollment',()=>{
  const learned=model();let state=track(frame([object(68,46)]),learned,initialState());
  for(let i=0;i<3;i++){
   state=track(frame([object(68,46),{x:68,y:46,w:24,h:20,paint:green}],600+i),learned,state);
   expect(state.status).toBe('searching');expect(state.box).not.toBeNull();
  }
  state=track(frame([object(74,50)],610),learned,state);
  expect(state.status).toBe('tracking');expect(iou(state.box!,{x:74,y:50,w:24,h:32})).toBeGreaterThan(.3);
 });
 it('reports when the object is hidden and finds it again elsewhere',()=>{
  const learned=model();let state=initialState();
  state=track(frame([object(30,30)],2),learned,state);expect(state.status).toBe('tracking');
  for(let step=0;step<12;step++)state=track(frame([{x:110,y:70,w:24,h:32,paint:green}],200+step),learned,state);
  expect(state.status).toBe('searching');expect(state.box).toBeNull();
  state=track(frame([object(120,70)],300),learned,state);
  expect(state.status).toBe('tracking');expect(iou(state.box!,{x:120,y:70,w:24,h:32})).toBeGreaterThan(.3);
 });
 it('never claims a match in a scene without the object',()=>{
  const learned=model();let state=initialState();
  for(let step=0;step<5;step++){state=track(frame([{x:40+step*4,y:40,w:30,h:30,paint:green}],400+step),learned,state);expect(state.status).toBe('searching');}
 });
});
