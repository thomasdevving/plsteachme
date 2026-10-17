import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
import { fetchWithTimeout, serviceFetch } from '../lib/network';
import { limitedJson } from '../lib/coaching-security';
import { readJSON } from '../lib/ai/server';
import { parse } from '../lib/http';
import { authConfig } from '../lib/auth/config';
import { platformFetch, platformAction } from '../lib/platform-client';
import { platformDb } from '../lib/platform-server';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const headers = {'content-type':'application/json', origin:'http://localhost'};
function streamRequest(stream: ReadableStream, signal?: AbortSignal) {
  return new NextRequest('http://localhost/api/waitlist', {method:'POST', headers:{...headers,'x-forwarded-for':crypto.randomUUID()}, body:stream, signal, duplex:'half'} as ConstructorParameters<typeof NextRequest>[1]);
}

describe('bounded incoming requests', () => {
  it('rejects a chunked form before buffering its remaining body', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(17_000)); }, cancel});
    const result = await parse(streamRequest(stream), z.object({email:z.string()}));
    expect('response' in result && result.response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('enforces byte limits on multibyte JSON even with a dishonest content length', async () => {
    const request = new Request('http://localhost', {method:'POST',headers:{...headers,'content-length':'1'},body:JSON.stringify({text:'é'.repeat(100)})});
    expect(await limitedJson(request, 150)).toEqual({error:'size'});
  });
  it.each(['text/plain', 'application/jsonp', 'text/plain; application/json'])('rejects %s as JSON', async type => {
    const request = new Request('http://localhost', {method:'POST',headers:{'content-type':type},body:'{}'});
    await expect(readJSON(request)).rejects.toThrow();
  });
  it('accepts valid JSON with a charset and releases its stream lock', async () => {
    const request = new Request('http://localhost', {method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:'{"ok":true}'});
    expect(await limitedJson(request,100)).toEqual({data:{ok:true}});
    expect(request.body?.locked).toBe(false);
  });
  it('cancels stalled uploads when the caller disconnects', async () => {
    const abort = new AbortController();
    const cancel = vi.fn();
    const request = streamRequest(new ReadableStream({cancel}), abort.signal);
    const reading = limitedJson(request, 100);
    abort.abort();
    expect(await reading).toEqual({error:'validation'});
    expect(cancel).toHaveBeenCalledOnce();
    expect(request.body?.locked).toBe(false);
  });
  it('ends a stalled body at its server deadline', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal);
    const cancel = vi.fn();
    const reading = limitedJson(streamRequest(new ReadableStream({cancel})),100);
    deadline.abort(new DOMException('Timed out','TimeoutError'));
    expect(await reading).toEqual({error:'validation'});
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe('network recovery', () => {
  it('returns database outages promptly instead of retrying beyond the app deadline',async()=>{
    vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-service-key');
    const fetcher=vi.fn(async()=>Response.json({message:'unavailable'},{status:503}));vi.stubGlobal('fetch',fetcher);
    const result=await platformDb().from('community_requests').select('id');
    expect(result.error).toBeTruthy();expect(fetcher).toHaveBeenCalledOnce();
  });
  function stalledFetch() {
    const fetcher = vi.fn((_input:unknown, init?:RequestInit) => new Promise<Response>((_resolve,reject) => {
      const signal=init!.signal!;
      if(signal.aborted) reject(signal.reason);
      else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
    }));
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  }
  it('aborts an unresponsive service once without retrying a mutation', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal);
    const fetcher = stalledFetch();
    const pending = serviceFetch('https://example.test/rest/v1/requests',{method:'POST',body:'{}'});
    deadline.abort(new DOMException('Timed out','TimeoutError'));
    await expect(pending).rejects.toMatchObject({name:'TimeoutError'});
    expect(timeout).toHaveBeenCalledWith(15_000);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('preserves cancellation supplied on a Request object and in init', async () => {
    stalledFetch();
    for(const throughRequest of [true,false]) {
      const caller = new AbortController();
      const input = throughRequest ? new Request('https://example.test',{signal:caller.signal}) : 'https://example.test';
      const pending = fetchWithTimeout(input,throughRequest?{}:{signal:caller.signal});
      caller.abort();
      await expect(pending).rejects.toMatchObject({name:'AbortError'});
    }
  });
  it('rejects a malformed success response instead of treating it as saved platform data', async () => {
    for(const body of ['not-json','null','[]']) {
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(body,{status:200})));
      await expect(platformAction({action:'support'})).rejects.toThrow('incomplete response');
    }
  });
  it('bounds platform reads while keeping caller cancellation', async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal);
    stalledFetch();
    const pending = platformFetch('view=me');
    deadline.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
  });
});

describe('configuration normalization', () => {
  it('treats blank credentials as missing and uses supported public fallbacks', () => {
    vi.stubEnv('SUPABASE_URL',' '); vi.stubEnv('SUPABASE_ANON_KEY',' ');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',' https://project.supabase.co ');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',' public-key ');
    expect(authConfig()).toMatchObject({url:'https://project.supabase.co',key:'public-key',enabled:true});
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',' '); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','');
    expect(authConfig().enabled).toBe(false);
  });
});
