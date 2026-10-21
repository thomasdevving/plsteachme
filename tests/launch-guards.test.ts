import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp } from '../lib/client-ip';
import { allow } from '../lib/rate-limit';
import { logAiFailure } from '../lib/log';
import { internalToolsEnabled } from '../lib/internal-tools';

afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('public launch guards',()=>{
 it('uses the address Cloudflare sets, not one the visitor supplies',()=>{
  const request=new Request('https://plsteach.me/api',{headers:{'cf-connecting-ip':'203.0.113.7','x-forwarded-for':'1.2.3.4, 203.0.113.7'}});
  expect(clientIp(request)).toBe('203.0.113.7');
  expect(clientIp(new Request('http://localhost/api',{headers:{'x-forwarded-for':'10.0.0.1'}}))).toBe('10.0.0.1');
  expect(clientIp(new Request('http://localhost/api'))).toBe('local');
 });
 it('keeps admitting new visitors when the in-memory limiter is full',()=>{
  const now=Date.now();
  for(let i=0;i<10000;i++)allow(`flood-${i}`,now);
  expect(allow('real-visitor',now)).toBe(true);
 });
 it('logs AI failures by category only, never the provider message',()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  logAiFailure('coaching.check',Object.assign(new Error('You exceeded your current quota for prompt "secret learner text"'),{statusCode:429}));
  logAiFailure('ask',new Error('The operation was aborted'));
  const lines=log.mock.calls.map(call=>JSON.parse(String(call[0])));
  expect(lines[0]).toMatchObject({event:'ai.quota',route:'coaching.check',status:429});
  expect(lines[1]).toMatchObject({event:'ai.timeout'});
  expect(JSON.stringify(lines)).not.toContain('secret learner text');
 });
 it('keeps internal tools off on a deployed site unless enabled',()=>{
  vi.stubEnv('NODE_ENV','production');
  expect(internalToolsEnabled()).toBe(false);
  vi.stubEnv('ENABLE_INTERNAL_TOOLS','true');
  expect(internalToolsEnabled()).toBe(true);
 });
});
