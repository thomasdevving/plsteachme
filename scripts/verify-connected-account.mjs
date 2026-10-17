import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Explicit integration check: creates two disposable accounts at example.com,
// sends no email, makes no AI calls, and removes only its own fixtures in finally.
const target = new URL(process.argv[2] || '');
assert(target.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(target.hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(25_000) }),
} };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const publicKey = process.env.SUPABASE_ANON_KEY;
const fixtures = [];
let count = 0;
let current = 'Create disposable fixtures';
const pass = name => { count++; console.log(`PASS ${name}`); };
const checked = result => { assert.equal(result.error, null); return result.data; };
const call = (path, init = {}) => fetch(new URL(path, target), { ...init, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
try {
  for (let i = 0; i < 2; i++) {
    const email = `plsteach-setup-${randomUUID()}@example.com`;
    const { user } = checked(await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { setup_check: true } }));
    fixtures.push(user);
  }
  current = 'Email token establishes a secure browser session';
  const link = checked(await admin.auth.admin.generateLink({ type: 'magiclink', email: fixtures[0].email }));
  const confirmation = await call(`/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}`);
  assert.equal(confirmation.status, 307);
  assert.equal(new URL(confirmation.headers.get('location')).pathname, '/account');
  const cookies = confirmation.headers.getSetCookie();
  assert(cookies.length && cookies.every(value => /httponly/i.test(value) && /secure/i.test(value)));
  assert.match(confirmation.headers.get('cache-control'), /no-store/);
  const cookie = cookies.map(value => value.split(';')[0]).join('; ');
  pass(current);
  const session = async () => {
    const response = await call('/api/auth/session', { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    return response.json();
  };
  current = 'New account has an unused entitlement';
  const initial = await session();
  assert.equal(initial.user.id, fixtures[0].id);
  assert.equal(initial.trial, null);
  pass(current);
  current = 'Missing AI leaves the free session unused';
  const ai = await (await call('/api/config')).json();
  assert.equal(ai.available, false, 'Run this no-inference check before adding the OpenAI key.');
  const start = await call('/api/trial', { method: 'POST', headers: { cookie, origin: target.origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'start', skillId: 'tie-four-in-hand' }) });
  assert.equal(start.status, 503);
  assert.equal((await session()).trial, null);
  pass(current);
  current = 'Concurrent starts share exactly one account entitlement';
  const claims = await Promise.all(Array.from({ length: 4 }, (_, i) => admin.rpc('claim_coaching_trial', {
    p_user_id: fixtures[0].id, p_skill_id: i % 2 ? 'builtin:laundry' : 'tie-four-in-hand', p_total_steps: 7,
  }).then(checked)));
  assert.equal(new Set(claims.map(trial => trial.id)).size, 1);
  assert.equal(new Set(claims.map(trial => trial.skill_id)).size, 1);
  const trial = claims[0];
  assert.equal((await session()).trial.id, trial.id);
  pass(current);
  current = 'Accounts can read only their own trial and cannot grant themselves another';
  for (let i = 0; i < 2; i++) {
    const client = createClient(process.env.SUPABASE_URL, publicKey, options);
    const token = checked(await admin.auth.admin.generateLink({ type: 'magiclink', email: fixtures[i].email }));
    checked(await client.auth.verifyOtp({ type: 'email', token_hash: token.properties.hashed_token }));
    const ownView = checked(await client.from('coaching_trials').select('id').eq('user_id', fixtures[0].id));
    assert.equal(ownView.length, i === 0 ? 1 : 0);
    const forbidden = await client.rpc('claim_coaching_trial', { p_user_id: fixtures[i].id, p_skill_id: 'builtin:laundry', p_total_steps: 7 });
    assert(forbidden.error);
  }
  pass(current);
  current = 'Progress is monotonic, account-bound, and completion cannot reset the entitlement';
  assert.equal(checked(await admin.rpc('advance_coaching_trial', { p_user_id: fixtures[1].id, p_session_id: trial.id, p_completed_steps: 7 })), null);
  const advance = steps => admin.rpc('advance_coaching_trial', { p_user_id: fixtures[0].id, p_session_id: trial.id, p_completed_steps: steps }).then(checked);
  assert.equal((await advance(3)).completed_steps, 3);
  assert.equal((await advance(1)).completed_steps, 3);
  assert((await advance(7)).completed_at);
  const repeated = checked(await admin.rpc('claim_coaching_trial', { p_user_id: fixtures[0].id, p_skill_id: 'builtin:cooking', p_total_steps: 7 }));
  assert.equal(repeated.id, trial.id);
  assert(repeated.completed_at);
  assert((await session()).trial.completed_at);
  pass(current);
  current = 'Unauthenticated and cross-site writes are refused';
  const payload = JSON.stringify({ action: 'progress', sessionId: trial.id, completedSteps: 7 });
  assert.equal((await call('/api/trial', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/json' }, body: payload })).status, 401);
  assert.equal((await call('/api/trial', { method: 'POST', headers: { cookie, origin: 'https://example.com', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }, body: payload })).status, 403);
  pass(current);
} catch {
  console.error(`FAIL ${current}. No credentials or raw provider responses are printed.`);
  process.exitCode = 1;
} finally {
  let cleanupComplete = true;
  for (const user of fixtures) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) { console.error(`Cleanup required for setup fixture ${user.id}`); process.exitCode = 1; cleanupComplete = false; }
    else {
      const remaining = await admin.from('coaching_trials').select('id').eq('user_id', user.id);
      if (remaining.error || remaining.data.length) { console.error('Fixture cleanup verification failed.'); process.exitCode = 1; cleanupComplete = false; }
    }
  }
  console.log(`${count} connected checks passed. ${cleanupComplete ? 'Disposable accounts removed.' : 'Some fixture cleanup needs attention.'} No email or AI calls made.`);
}
