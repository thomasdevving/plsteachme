'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/network';

type Factor = { id: string; name: string };
type Enrollment = { id: string; qr: string; secret: string };
async function security(action?: Record<string, unknown>) {
  const response = await fetchWithTimeout('/api/auth/mfa', action ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) } : { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Account security is temporarily unavailable.');
  return result;
}
function CodeField({ code, setCode, busy }: { code: string; setCode: (value: string) => void; busy: boolean }) {
  return <label className="mfa-code-field">Authenticator code<input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} placeholder="000000" /></label>;
}
export function MfaChallenge({ next }: { next: string }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factor, setFactor] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    security().then(result => {
      if (!active) return;
      if (!result.required) { window.location.assign(next); return; }
      setFactors(result.factors); setFactor(result.factors[0]?.id || '');
    }).catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [next]);
  return <div className="auth-form-area"><ShieldCheck size={30} aria-hidden="true" /><h1>One more check.</h1><p className="auth-intro">Enter the six-digit code from your authenticator app to finish signing in.</p>
    {loading ? <p role="status">Checking account security…</p> : <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try { const result = await security({ action: 'verify', factorId: factor, code, next }); setCode(''); window.location.assign(result.url); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Verification failed.'); setCode(''); }
      finally { setBusy(false); }
    }}>
      {factors.length > 1 && <label>Authenticator<select value={factor} onChange={event => setFactor(event.target.value)} disabled={busy}>{factors.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      <CodeField code={code} setCode={setCode} busy={busy} />
      <button type="submit" className="button primary auth-submit" disabled={busy || !factor || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
    </form>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    <p className="auth-hint">Keep access to your authenticator app. An email or password reset does not replace this security check.</p>
    <button type="button" className="auth-text-button" onClick={async () => { try { const response = await fetchWithTimeout('/api/auth/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) }); if (!response.ok) throw new Error(); window.location.assign('/login'); } catch { setError('Could not sign out. Please try again.'); } }}>Use a different account</button>
  </div>;
}
export function MfaSettings() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  useEffect(() => { let active = true; security().then(result => { if (active) setFactors(result.factors); }).catch(reason => { if (active) setError(reason.message); }); return () => { active = false; }; }, []);
  async function action(payload: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await security(payload);
      if (result.enrollment) { setEnrollment(result.enrollment); return; }
      setEnrollment(null); setCode(''); setRemove(false);
      const status = await security(); setFactors(status.factors);
      setMessage(payload.action === 'verify' ? 'Two-step verification is enabled.' : 'Authenticator removed.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="account-mfa" aria-labelledby="mfa-title"><h2 id="mfa-title">Two-step verification</h2>
    <p>Add a code from an authenticator app when you log in.</p>
    {enrollment ? <div className="mfa-enrollment">
      <p>Scan this QR code with an authenticator app, then enter its six-digit code.</p>
      {/* Provider SVG is isolated in an image; never inserted as executable HTML. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`} width={200} height={200} alt="QR code to add plsteach.me to your authenticator" />
      <details><summary>Can’t scan? Enter the setup key manually</summary><code className="mfa-secret">{enrollment.secret}</code></details>
      <p className="auth-hint">Save a secure backup in your authenticator app before continuing. Keep this setup key private.</p>
      <form onSubmit={event => { event.preventDefault(); void action({ action: 'verify', factorId: enrollment.id, code }); }}><CodeField code={code} setCode={setCode} busy={busy} /><div className="mfa-actions"><button type="submit" className="button primary compact" disabled={busy || code.length !== 6}>Enable verification</button><button type="button" className="auth-text-button" disabled={busy} onClick={() => void action({ action: 'remove', factorId: enrollment.id })}>Cancel setup</button></div></form>
    </div> : factors?.length ? <><p><ShieldCheck size={16} aria-hidden="true" /> Authenticator enabled</p>{remove ? <><p>Remove this extra protection from your account?</p><div className="mfa-actions"><button type="button" className="button secondary compact" disabled={busy} onClick={() => void action({ action: 'remove', factorId: factors[0].id })}>Remove authenticator</button><button type="button" className="auth-text-button" disabled={busy} onClick={() => setRemove(false)}>Keep it enabled</button></div></> : <button type="button" className="auth-text-button" onClick={() => setRemove(true)}>Manage authenticator</button>}</>
      : factors ? <button type="button" className="button secondary compact" disabled={busy} onClick={() => void action({ action: 'enroll' })}>{busy ? 'Preparing…' : 'Set up authenticator'}</button> : !error && <p role="status">Loading security settings…</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="auth-error">{error}</p>}
  </section>;
}
