import { describe, expect, it } from 'vitest';
import { builtinCameraGuidance, guidedObject } from '../lib/vision/camera-guidance';
import { objectGuide, previewGeometry, previewPoint } from '../lib/vision/camera-preview';
import { inObjectGuide } from '../lib/vision/object-scan-contract';
import { visibleBody } from '../lib/vision/body-overlay';
import { scanMotion, scanQuality } from '../lib/vision/scan-stability';
import type { Frame } from '../lib/vision/object-tracker';
import type { LandmarkFrame } from '../lib/vision/prechecks';
describe('module-specific camera guidance',()=>{
 it('uses an object outline only for explicitly supported built-ins',()=>{
  expect(guidedObject(builtinCameraGuidance.tie)).toBe('tie');expect(guidedObject(builtinCameraGuidance.shaving)).toBe('razor');
  for(const key of ['cooking','laundry','ironing','button','drill','bike'] as const)expect(guidedObject(builtinCameraGuidance[key])).toBeNull();
  expect(guidedObject('body')).toBeNull();expect(guidedObject(undefined)).toBeNull();
 });
 it('maps full-image coordinates through letterboxing and mirroring without cropping',()=>{
  const geometry=previewGeometry(640,480,800,400);
  expect(previewPoint(0,0,geometry,false)).toEqual({x:133.33333333333331,y:0});
  const normal=previewPoint(.2,.3,geometry,false),mirror=previewPoint(.2,.3,geometry,true);
  expect(normal.x+mirror.x).toBeCloseTo(800);expect(normal.y).toBe(mirror.y);
 });
 it('allows approximate placement but rejects an object elsewhere or tiny in the background',()=>{
  const guide=objectGuide('tie');expect(inObjectGuide({x:.41,y:.16,w:.16,h:.65},guide)).toBe(true);
  expect(inObjectGuide({x:.02,y:.02,w:.1,h:.3},guide)).toBe(false);
  expect(inObjectGuide({x:.49,y:.49,w:.005,h:.005},guide)).toBe(false);
 });
 it('never draws invented, hidden or ambiguous body joints',()=>{
  const frame:LandmarkFrame={pose:Array.from({length:33},()=>({x:.5,y:.5,visibility:.9})),hands:[],luminance:100,ambiguous:false,time:0,aspect:4/3};
  expect(visibleBody(frame).ready).toBe(true);expect(visibleBody(frame).lines.length).toBeGreaterThan(10);
  frame.pose[11].visibility=.1;expect(visibleBody(frame).ready).toBe(false);
  expect(visibleBody({...frame,ambiguous:true}).lines).toEqual([]);
  expect(visibleBody({...frame,pose:[]}).lines).toEqual([]);
 });
 it('rejects a blank capture and detects replacement/motion without calling it object recognition',()=>{
  const make=(value:number):Frame=>({width:16,height:16,data:new Uint8ClampedArray(16*16*4).fill(value)}),box={x:0,y:0,w:16,h:16};
  const blank=make(120),changed=make(240);expect(scanQuality(blank,box)).toBe(false);
  expect(scanMotion(blank,blank,box)).toBe(0);expect(scanMotion(blank,changed,box)).toBeGreaterThan(.3);
 });
});
