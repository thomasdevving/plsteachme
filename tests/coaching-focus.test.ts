import { describe, expect, it } from 'vitest';
import { focusBoxSchema, trackingFocus } from '../lib/vision/coaching-focus';
import { coachRequestSchema } from '../lib/coaching-contract';
import { platformActionSchema } from '../lib/platform-contract';
import { trainingActionSchema } from '../lib/training-contract';

const box={x:16,y:24,w:32,h:48};
const id='11111111-1111-4111-8111-111111111111';
const frames=['data:image/jpeg;base64,/9j/'];
describe('camera focus coordinates and contracts',()=>{
 it('normalizes raw frame pixels without applying the mirrored preview transform',()=>{
  expect(trackingFocus({box,score:.8,status:'tracking',misses:0},{width:160,height:120})).toEqual({x:.1,y:.2,w:.2,h:.4});
 });
 it('never sends a held, uncertain box as a current match',()=>{
  expect(trackingFocus({box,score:0,status:'searching',misses:1},{width:160,height:120})).toBeNull();
 });
 it('rejects nonfinite and out-of-frame coordinates',()=>{
  for(const x of [NaN,Infinity,-.1,1.1])expect(focusBoxSchema.safeParse({x,y:0,w:.2,h:.3}).success).toBe(false);
 });
 it.each([
  [coachRequestSchema,{skill:'tie',step:0,frames}],
  [platformActionSchema,{action:'lesson.coach',id,version:1,step:0,frames,consent:true,over16:true}],
  [trainingActionSchema,{action:'module.coach',moduleId:id,version:1,step:0,frames,consent:true,over16:true}]
 ])('accepts optional paired hints and rejects mismatches for every coaching route', (schema,payload)=>{
  expect(schema.safeParse(payload).success).toBe(true);
  expect(schema.safeParse({...payload,focusBoxes:[{x:.1,y:.2,w:.2,h:.4}]}).success).toBe(true);
  expect(schema.safeParse({...payload,focusBoxes:[null,null]}).success).toBe(false);
 });
});
