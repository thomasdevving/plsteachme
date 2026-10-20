// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLessonProgress, readProgress, saveLessonProgress } from '../lib/learning-progress';
import { applyRemote, localEntries, startProgressSync } from '../lib/progress-sync';

const published='22222222-2222-4222-8222-222222222222';
const lesson=(step:number,updatedAt:number)=>({...emptyLessonProgress('shaving'),step,updatedAt});
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

describe('account progress sync',()=>{
 it('applies only valid account copies',()=>{
  expect(applyRemote({lessonKey:'builtin:shaving',data:lesson(2,10),updatedAt:10})).toBe(true);
  expect(readProgress().lessons.shaving?.step).toBe(2);
  expect(applyRemote({lessonKey:'builtin:shaving',data:{...lesson(2,10),step:99},updatedAt:11})).toBe(false);
  expect(applyRemote({lessonKey:'builtin:notaskill',data:lesson(1,10),updatedAt:10})).toBe(false);
  expect(applyRemote({lessonKey:`published:${published}:v3`,data:{step:1,completed:false,results:['manual']},updatedAt:20})).toBe(true);
  expect(applyRemote({lessonKey:`published:${published}:v3`,data:{step:'1'},updatedAt:21})).toBe(false);
  expect(localEntries().get(`published:${published}:v3`)).toEqual({data:{step:1,completed:false,results:['manual']},updatedAt:20});
 });
 it('merges newer account copies and uploads newer local ones',async()=>{
  saveLessonProgress('shaving',lesson(1,100));
  saveLessonProgress('tie',{...emptyLessonProgress('tie'),step:3,updatedAt:500});
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>init?.method==='POST'?new Response('{}'):Response.json({progress:[
   {lessonKey:'builtin:shaving',data:lesson(4,200),updatedAt:200},
   {lessonKey:'builtin:tie',data:{...emptyLessonProgress('tie'),step:1,updatedAt:300},updatedAt:300},
  ]}));
  const stop=startProgressSync();
  await vi.waitFor(()=>expect(fetch.mock.calls.some(call=>call[1]?.method==='POST')).toBe(true));
  expect(readProgress().lessons.shaving?.step).toBe(4);expect(readProgress().lessons.tie?.step).toBe(3);
  const posts=fetch.mock.calls.filter(call=>call[1]?.method==='POST').map(call=>JSON.parse(String(call[1]!.body)).lessonKey);
  expect(posts).toEqual(['builtin:tie']);
  // Later local changes go up after a short pause.
  saveLessonProgress('shaving',lesson(5,900));
  await vi.advanceTimersByTimeAsync(900);
  expect(fetch.mock.calls.filter(call=>call[1]?.method==='POST').map(call=>JSON.parse(String(call[1]!.body)).lessonKey)).toEqual(['builtin:tie','builtin:shaving']);
  stop();
 });
});
