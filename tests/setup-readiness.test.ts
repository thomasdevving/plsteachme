import { describe,expect,it,vi } from 'vitest';
import { checkSetup,setupTables } from '../scripts/verify-setup';
import { isPublicSupabaseKey } from '../lib/public-key';
const reviewer='11111111-1111-4111-8111-111111111111';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test-public',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test-private',OPENAI_API_KEY:'test-openai-private',NEXT_PUBLIC_SITE_URL:'https://app.example.test',PLATFORM_REVIEWER_IDS:reviewer};
function responses(input:RequestInfo|URL,init?:RequestInit):Response {
  const url=new URL(input instanceof Request?input.url:String(input));
  const headers=new Headers(init?.headers);
  if(url.hostname==='app.example.test')return Response.json({configured:true,available:true,aiAvailable:true,mock:false});
  if(url.hostname==='api.openai.com')return Response.json({id:decodeURIComponent(url.pathname.split('/').at(-1)!)});
  if(url.pathname.includes('/auth/v1/admin/users/'))return Response.json({id:reviewer,email_confirmed_at:'2026-10-17',is_anonymous:false});
  if(url.pathname.includes('/storage/v1/bucket/'))return Response.json({id:'teacher-demonstrations',name:'teacher-demonstrations',public:false,file_size_limit:100*1024*1024,allowed_mime_types:['video/mp4','video/webm','video/quicktime']});
  if(url.pathname==='/rest/v1/')return Response.json({paths:Object.fromEntries(['claim_coaching_trial','advance_coaching_trial','platform_mutate','increment_under16'].map(name=>[`/rpc/${name}`,{post:{}}]))});
  if(headers.get('apikey')===env.SUPABASE_ANON_KEY)return Response.json({message:'permission denied'},{status:403});
  return Response.json([]);
}
describe('read-only setup verification',()=>{
  it('reports missing configuration without making network calls',async()=>{
    const fetcher=vi.fn();const checks=await checkSetup({},fetcher);
    expect(checks.every(check=>!check.ok)).toBe(true);expect(fetcher).not.toHaveBeenCalled();
  });
  it('checks connected schema, private storage, reviewers and model access without writes or credential disclosure',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>responses(input,init));
    const checks=await checkSetup(env,fetcher,'https://app.example.test');
    expect(checks.filter(check=>!check.ok)).toEqual([]);
    for(const [input,init] of fetcher.mock.calls) {
      expect(['GET','HEAD','OPTIONS']).toContain(init?.method || 'GET');
      expect(init?.redirect).toBe('error');
      if(String(input).startsWith('https://app.example.test')) {
        expect(new Headers(init?.headers).has('authorization')).toBe(false);
        expect(new Headers(init?.headers).has('apikey')).toBe(false);
      }
    }
    expect(checks.filter(check=>check.name.startsWith('Database:'))).toHaveLength(Object.keys(setupTables).length);
    for(const secret of [env.SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY,env.OPENAI_API_KEY])expect(JSON.stringify(checks)).not.toContain(secret);
  });
  it('catches a missing migration, exposed anonymous data, public bucket and unavailable model',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      if(url.includes('/platform_lessons?'))return Response.json({message:'private error details'},{status:404});
      if(url.includes('/waitlist?'))return Response.json([]);
      if(url.includes('/storage/v1/bucket/'))return Response.json({public:true});
      if(url.includes('api.openai.com'))return Response.json({error:'provider-secret-details'},{status:403});
      return responses(input,init);
    });
    const checks=await checkSetup(env,fetcher);
    for(const name of ['Database: platform_lessons','Anonymous access: waitlist','Private teacher storage','Vision model','Transcription model'])expect(checks.find(check=>check.name===name)?.ok).toBe(false);
    expect(JSON.stringify(checks)).not.toContain('private error details');expect(JSON.stringify(checks)).not.toContain('provider-secret-details');
  });
  it('rejects privileged keys in public configuration',async()=>{
    const legacy=`e30.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.signature`;
    for(const key of [env.SUPABASE_SERVICE_ROLE_KEY,legacy]) {
      expect(isPublicSupabaseKey(key)).toBe(false);
      const checks=await checkSetup({...env,SUPABASE_ANON_KEY:key},async(input,init)=>responses(input,init));
      expect(checks.find(check=>check.name==='Supabase public key')?.ok).toBe(false);
    }
  });
  it('fails unavailable services without printing raw errors or rejecting the report',async()=>{
    const checks=await checkSetup(env,async()=>{throw new Error('secret credential in network error');});
    expect(checks.some(check=>!check.ok)).toBe(true);
    expect(JSON.stringify(checks)).not.toContain('secret credential');
  });
  it('rejects credential-bearing deployment URLs before any request to that host',async()=>{
    const fetcher=vi.fn();const checks=await checkSetup({},fetcher,'https://user:password@app.example.test');
    expect(checks.find(check=>check.name==='Deployment URL')?.ok).toBe(false);expect(fetcher).not.toHaveBeenCalled();
  });
});
