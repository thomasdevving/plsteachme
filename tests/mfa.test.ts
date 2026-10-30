import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({ user: vi.fn(), assurance: vi.fn(), factors: vi.fn(), enroll: vi.fn(), verify: vi.fn(), remove: vi.fn(), rpc: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: s.user, mfa: { getAuthenticatorAssuranceLevel: s.assurance, listFactors: s.factors, enroll: s.enroll, challengeAndVerify: s.verify, unenroll: s.remove } } }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@/lib/auth/config', () => ({ authConfig: () => ({ enabled: true, url: 'https://project.supabase.co', key: 'public' }) }));
vi.mock('@/lib/storage', () => ({ db: () => ({ rpc: s.rpc }), hash: () => 'hashed-ip' }));
import { authenticatedUser } from '../lib/auth/server';
import { needsMfa } from '../lib/auth/mfa';
import { GET, POST } from '../app/api/auth/mfa/route';
import { refreshAuth } from '../lib/auth/proxy';
import { NextRequest } from 'next/server';
import { platformUser } from '../lib/platform-server';

const factor = { id: '11111111-1111-4111-8111-111111111111', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' };
const user = { id: '22222222-2222-4222-8222-222222222222', factors: [factor] };
const request = (body: unknown, origin = 'https://plsteach.me') => new Request('https://plsteach.me/api/auth/mfa', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  s.user.mockResolvedValue({ data: { user }, error: null });
  s.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
  s.factors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null });
  s.rpc.mockResolvedValue({ data: true, error: null });
  s.verify.mockResolvedValue({ data: {}, error: null });
  s.remove.mockResolvedValue({ data: {}, error: null });
});
it('does not treat a password-only session as authenticated after MFA is enabled', async () => {
  expect(await authenticatedUser()).toBeNull();
  s.assurance.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
  expect(await authenticatedUser()).toEqual(user);
  s.assurance.mockResolvedValue({ data: null, error: new Error('unavailable') });
  await expect(authenticatedUser()).rejects.toThrow('assurance');
});
it('does not require MFA for accounts that have not enabled it', async () => {
  s.user.mockResolvedValue({ data: { user: { id: user.id, factors: [{ ...factor, status: 'unverified' }] } }, error: null });
  expect(await authenticatedUser()).toMatchObject({ id: user.id });
  expect(s.assurance).not.toHaveBeenCalled();
});
it('checks assurance against the validated bearer JWT as well as cookie sessions', async () => {
  const client = { auth: { mfa: { getAuthenticatorAssuranceLevel: s.assurance } } };
  expect(await needsMfa(client as never, user as never, 'validated-jwt')).toBe(true);
  expect(s.assurance).toHaveBeenCalledWith('validated-jwt');
});
it('redirects protected pages to MFA and leaves the challenge page reachable', async () => {
  const response = await refreshAuth(new NextRequest('https://plsteach.me/account'));
  expect(response.headers.get('location')).toBe('https://plsteach.me/login/mfa?next=%2Faccount');
  expect((await refreshAuth(new NextRequest('https://plsteach.me/login/mfa'))).headers.has('location')).toBe(false);
});
it('only exposes factor labels/IDs and requires a registered factor before verifying', async () => {
  expect(await (await GET()).json()).toEqual({ required: true, factors: [{ id: factor.id, name: 'Phone' }] });
  expect((await POST(request({ action: 'verify', factorId: user.id, code: '123456' }))).status).toBe(400);
  expect(s.verify).not.toHaveBeenCalled();
  const response = await POST(request({ action: 'verify', factorId: factor.id, code: '123456', next: 'https://attacker.test' }));
  expect(await response.json()).toEqual({ ok: true, url: '/account' });
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(s.verify).toHaveBeenCalledWith({ factorId: factor.id, code: '123456' });
});
it('prevents removing MFA or enrolling a different factor with only a password', async () => {
  expect((await POST(request({ action: 'remove', factorId: factor.id }))).status).toBe(403);
  expect((await POST(request({ action: 'enroll' }))).status).toBe(403);
  expect(s.remove).not.toHaveBeenCalled(); expect(s.enroll).not.toHaveBeenCalled();
});
it('rejects cross-origin requests, invalid OTPs, signed-out callers and durable limiter outages', async () => {
  expect((await POST(request({ action: 'enroll' }, 'https://attacker.test'))).status).toBe(403);
  expect((await POST(request({ action: 'verify', factorId: factor.id, code: '123' }))).status).toBe(400);
  s.rpc.mockResolvedValue({ data: null, error: { code: 'missing' } });
  expect((await POST(request({ action: 'verify', factorId: factor.id, code: '123456' }))).status).toBe(503);
  s.rpc.mockResolvedValue({ data: false, error: null });
  expect((await POST(request({ action: 'verify', factorId: factor.id, code: '123456' }))).status).toBe(429);
  s.user.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET()).status).toBe(401); expect(s.verify).not.toHaveBeenCalled();
});
it('activates only after a correct code, cleans abandoned enrollments and keeps provider errors private', async () => {
  s.user.mockResolvedValue({ data: { user: { ...user, factors: [] } }, error: null });
  s.factors.mockResolvedValue({ data: { all: [{ ...factor, status: 'unverified' }], totp: [] }, error: null });
  s.enroll.mockResolvedValue({ data: { id: factor.id, totp: { qr_code: '<svg/>', secret: 'private-setup-key' } }, error: null });
  const response = await POST(request({ action: 'enroll' }));
  expect(await response.json()).toMatchObject({ enrollment: { id: factor.id, secret: 'private-setup-key' } });
  expect(s.remove).toHaveBeenCalledWith({ factorId: factor.id }); expect(s.verify).not.toHaveBeenCalled();
  s.verify.mockResolvedValue({ data: null, error: { message: 'private-provider-payload' } });
  expect(await (await POST(request({ action: 'verify', factorId: factor.id, code: '123456' }))).text()).not.toContain('private-provider-payload');
});

it('also blocks direct bearer-token API access until the same token has AAL2', async () => {
  const client = { auth: { getUser: s.user, mfa: { getAuthenticatorAssuranceLevel: s.assurance } } };
  const request = new NextRequest('https://plsteach.me/api/platform', { headers: { authorization: 'Bearer validated-token' } });
  await expect(platformUser(request, client as never)).rejects.toMatchObject({status:403,code:'mfa_required'});
  s.assurance.mockResolvedValue({data:{currentLevel:'aal2'},error:null});
  expect(await platformUser(request, client as never)).toEqual(user);
  expect(s.assurance).toHaveBeenLastCalledWith('validated-token');
});
