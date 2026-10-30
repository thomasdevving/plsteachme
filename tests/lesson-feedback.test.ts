import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), from: vi.fn(), filters: [] as unknown[], published: vi.fn(), training: vi.fn(), rows: [] as unknown[] }));
vi.mock('@/lib/auth/server', () => ({ authenticatedUser: s.user }));
vi.mock('@/lib/platform-server', async () => {
  const actual = await vi.importActual<typeof import('../lib/platform-server')>('../lib/platform-server');
  return { ...actual, platformConfigured: () => true, platformDb: () => ({ from: s.from, rpc: s.rpc }), publishedLesson: s.published };
});
vi.mock('@/lib/training-server', () => ({ practiceVersion: s.training }));
import { GET, POST } from '../app/api/lesson-feedback/route';
import { PlatformError } from '../lib/platform-server';
const user = { id: '11111111-1111-4111-8111-111111111111', email_confirmed_at: '2026-10-01' };
const other = '22222222-2222-4222-8222-222222222222';
const request = (body: unknown, origin='https://plsteach.me') => new NextRequest('https://plsteach.me/api/lesson-feedback',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const save = { action:'save',lessonKey:'builtin:tie',version:1,rating:4,comment:' Useful ' };
const read = (lessonKey='builtin:tie',version=1) => GET(new NextRequest(`https://plsteach.me/api/lesson-feedback?lessonKey=${lessonKey}&version=${version}`));
beforeEach(() => {
  vi.resetAllMocks(); s.filters=[];s.rows=[];
  s.user.mockResolvedValue(user);
  s.rpc.mockImplementation(async(name:string)=>({data:name==='rate_hit'?true:name==='lesson_feedback_summary'?{count:1,average:4}:null,error:null}));
  s.from.mockImplementation(()=>{
    const chain:Record<string,any>={};
    for(const method of ['select','eq','order','limit','delete'])chain[method]=(...args:unknown[])=>{s.filters.push([method,...args]);return chain;};
    chain.then=(resolve:(data:unknown)=>unknown)=>Promise.resolve({data:s.rows,error:null}).then(resolve);
    return chain;
  });
  s.published.mockResolvedValue({version:3}); s.training.mockResolvedValue({version:{version:2}});
});
it('returns only the current user comments, server dates, and a version-specific aggregate',async()=>{
  s.rows=[{version:1,rating:4,comment:'Useful',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-02T00:00:00Z'}];
  const response=await read();
  expect(await response.json()).toEqual({own:[{version:1,rating:4,comment:'Useful',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-02T00:00:00Z'}],summary:{count:1,average:4}});
  expect(s.filters).toContainEqual(['eq','user_id',user.id]);
  expect(s.rpc).toHaveBeenCalledWith('lesson_feedback_summary',{p_key:'builtin:tie',p_version:1});
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('saves a single rating per lesson version with server-owned dates and identity',async()=>{
  expect((await POST(request(save))).status).toBe(200);
  expect(s.rpc).toHaveBeenCalledWith('lesson_feedback_save',{p_user:user.id,p_key:'builtin:tie',p_version:1,p_rating:4,p_comment:'Useful'});
  expect((await POST(request({...save,userId:other,createdAt:'2020-01-01'}))).status).toBe(400);
});
it('validates real lessons, current versions, confirmed accounts and comment length',async()=>{
  for(const input of [{...save,rating:0},{...save,rating:6},{...save,comment:'x'.repeat(2001)}])expect((await POST(request(input))).status).toBe(400);
  expect((await POST(request({...save,lessonKey:'builtin:unknown'}))).status).toBe(404);
  expect((await POST(request({...save,version:2}))).status).toBe(409);
  s.user.mockResolvedValue({...user,email_confirmed_at:null});expect((await POST(request(save))).status).toBe(401);
  s.user.mockResolvedValue(null);expect((await read()).status).toBe(401);
  expect(s.rpc).not.toHaveBeenCalledWith('lesson_feedback_save',expect.anything());
});
it('requires publication and the existing assignment/membership checks for organization feedback',async()=>{
  expect((await read(`published:${other}`,3)).status).toBe(200);
  expect((await read(`published:${other}`,1)).status).toBe(409);
  s.training.mockRejectedValue(new PlatformError(403,'forbidden','Not assigned.'));
  s.from.mockClear();expect((await read(`training:${other}`,2)).status).toBe(403);
  expect(s.training).toHaveBeenCalledWith(expect.anything(),user.id,other);expect(s.from).not.toHaveBeenCalled();
});
it('deletes only the caller’s record and rejects cross-origin requests and limiter outages',async()=>{
  expect((await POST(request({action:'delete',lessonKey:save.lessonKey,version:1}))).status).toBe(200);
  expect(s.filters).toContainEqual(['eq','user_id',user.id]);expect(s.filters).toContainEqual(['eq','version',1]);
  expect((await POST(request(save,'https://attacker.test'))).status).toBe(403);
  s.rpc.mockResolvedValue({data:null,error:{code:'missing'}});expect((await POST(request(save))).status).toBe(503);
  s.rpc.mockResolvedValue({data:false,error:null});expect((await POST(request(save))).status).toBe(429);
});
