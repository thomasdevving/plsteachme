import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({mock:false,select:vi.fn()}));
vi.mock('@/lib/storage',()=>({get mockMode(){return state.mock;},db:()=>({from:()=>({select:state.select})}),hash:(value:string)=>value,record:vi.fn(),token:()=>'',under16Count:vi.fn()}));
import { GET } from '../app/api/waitlist/route';
beforeEach(()=>{state.mock=false;state.select.mockReset();});
describe('public waitlist total',()=>{
 it.each([0,1,1234])('returns only the exact aggregate %s without loading individual records',async(count)=>{
  state.select.mockResolvedValue({count,error:null,data:null});
  const response=await GET();
  expect(response.status).toBe(200);expect(await response.json()).toEqual({count});
  expect(state.select).toHaveBeenCalledWith('id',{count:'exact',head:true});
  expect(response.headers.get('cache-control')).toContain('s-maxage=60');
 });
 it('does not pretend an unconfigured database has zero waitlist members',async()=>{
  state.mock=true;const response=await GET();
  expect(response.status).toBe(503);expect(await response.json()).toEqual({count:null});expect(state.select).not.toHaveBeenCalled();
 });
 it('does not expose provider errors or substitute a fake number on failure',async()=>{
  state.select.mockResolvedValue({count:null,error:{message:'private database details'}});
  const response=await GET();expect(response.status).toBe(503);expect(await response.json()).toEqual({count:null});
  expect(response.headers.get('cache-control')).toBe('no-store');
 });
});
