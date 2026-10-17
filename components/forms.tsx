'use client';
import { fetchWithTimeout } from '@/lib/network';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { pathFor, skillIds, ages, payments, type Locale } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { attribution } from '@/lib/attribution';
import { track } from '@/lib/analytics';
import { FormField, Chip } from './ui';
function Honeypot({ c }: { c: Pick<Copy,'form'> }) { return <div className="honeypot" aria-hidden="true"><label htmlFor="website">{c.form.website}</label><input id="website" name="website" autoComplete="off" tabIndex={-1}/></div>; }
function Consent({ c, locale, text }: { c: Pick<Copy,'form'>; locale: Locale; text: string }) { return <label className="checkbox-row"><input name="consent" type="checkbox" required/><span>{text} <a href={pathFor(locale,'privacy')}>{c.form.privacy}</a></span></label>; }
export function WaitlistForm({ c, locale, mock }: { c: Pick<Copy,'form'|'skills'>; locale: Locale; mock: boolean }) {
  const [age, setAge] = useState(''); const [selected, setSelected] = useState<string[]>([]); const [busy,setBusy] = useState(false); const [message,setMessage] = useState(''); const [error,setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setError(false);
    const values = new FormData(event.currentTarget);
    const payload = age === 'under16' ? { age, website: values.get('website') || '' } : { age, email: values.get('email'), skills: selected, other: selected.includes('other') ? values.get('other') || '' : '', payment: values.get('payment') || undefined, consent: values.get('consent') === 'on', website: values.get('website') || '', attribution: attribution(locale) };
    const { waitlistSchema } = await import('@/lib/validation');
    const validated = waitlistSchema.safeParse(payload);
    if (!validated.success) { setError(true); setMessage(c.form.required); return; }
    setBusy(true);
    try {
      const res = await fetchWithTimeout('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validated.data) }); const data = await res.json();
      if (!res.ok) throw new Error(data.error === 'rate' ? c.form.rate : c.form.error);
      if (data.under16) { setMessage(c.form.under); track('waitlist_under16'); return; }
      if (!data.mock) track('waitlist_submit_success');
      location.assign(`${pathFor(locale,'thanks')}${data.mock ? '?preview=1' : ''}`);
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : c.form.error); } finally { setBusy(false); }
  }
  return <form className="signup-form" onSubmit={submit} aria-describedby="waitlist-note"><Honeypot c={c}/><FormField label={c.form.age} id="age"><select id="age" name="age" required value={age} onChange={e => { setAge(e.target.value); setMessage(''); }}><option value="">{c.form.choose}</option>{ages.map((value,i) => <option value={value} key={value}>{c.form.ageOptions[i]}</option>)}</select></FormField>{age === 'under16' ? <p className="under16-info">{c.form.under}</p> : <><FormField label={c.form.email} id="email"><input id="email" name="email" type="email" autoComplete="email" placeholder={c.form.emailPlaceholder} required maxLength={254}/></FormField><fieldset><legend>{c.form.skills}</legend><div className="chips">{[...skillIds,'other'].map(skill => <Chip key={skill} selected={selected.includes(skill)} onClick={() => setSelected(prev => prev.includes(skill) ? prev.filter(item => item !== skill) : [...prev,skill])}>{skill === 'other' ? c.form.other : c.skills.names[skill as typeof skillIds[number]]}</Chip>)}</div></fieldset>{selected.includes('other') && <FormField label={c.form.otherLabel} id="other"><input id="other" name="other" maxLength={500}/></FormField>}<FormField label={c.form.pay} id="payment"><select id="payment" name="payment"><option value="">{c.form.choose}</option>{payments.map((value,i) => <option key={value} value={value}>{c.form.payOptions[i]}</option>)}</select></FormField><Consent c={c} locale={locale} text={c.form.consent}/></>}<button className="button primary form-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={19} className="spin" aria-hidden="true"/>{c.form.submitting}</> : <>{c.form.submit}<ArrowUpRight size={18} aria-hidden="true"/></>}</button><p className="small" id="waitlist-note">{mock ? c.form.mock : c.form.note}</p><p className={`form-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{message}</p></form>;
}
export function OrganizationForm({ c, locale, mock }: { c: Pick<Copy,'form'|'org'>; locale: Locale; mock: boolean }) {
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState(''); const [success,setSuccess] = useState(false); const [error,setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setError(false); const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const { orgSchema } = await import('@/lib/validation');
    const result = orgSchema.safeParse({ ...values, consent: values.consent === 'on', attribution: attribution(locale) });
    if (!result.success) { setError(true); setMessage(c.form.required); return; }
    setBusy(true);
    try { const res = await fetchWithTimeout('/api/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result.data) }); const data = await res.json(); if (!res.ok) throw new Error(data.error === 'rate' ? c.form.rate : c.form.error); setMessage(data.mock ? c.form.mockSuccess : c.org.success); setSuccess(true); if (!data.mock) track('org_form_submit'); form.reset(); } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : c.form.error); } finally { setBusy(false); }
  }
  if (success) return <div className="success-panel" role="status"><Check size={32} aria-hidden="true"/><p>{message}</p></div>;
  return <form className="signup-form org-form" onSubmit={submit}><Honeypot c={c}/><div className="form-row"><FormField label={c.org.name} id="name"><input id="name" name="name" required maxLength={100} autoComplete="name"/></FormField><FormField label={c.org.organization} id="organization"><input id="organization" name="organization" required maxLength={160} autoComplete="organization"/></FormField></div><div className="form-row"><FormField label={c.org.role} id="role"><input id="role" name="role" required maxLength={100} autoComplete="organization-title"/></FormField><FormField label={c.org.type} id="type"><select id="type" name="type" required><option value="">{c.form.choose}</option>{['school','higher','youth','healthcare','employer','other'].map((type,i) => <option value={type} key={type}>{c.org.types[i]}</option>)}</select></FormField></div><FormField label={c.form.email} id="email"><input id="email" name="email" type="email" required maxLength={254} autoComplete="email"/></FormField><FormField label={c.org.phone} id="phone"><input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel"/></FormField><FormField label={c.org.needs} id="needs"><textarea id="needs" name="needs" rows={4} required maxLength={2000}/></FormField><Consent c={c} locale={locale} text={c.org.consent}/><button type="submit" className="button primary form-submit" disabled={busy}>{busy ? c.form.submitting : c.org.submit}<ArrowUpRight size={18} aria-hidden="true"/></button>{mock && <p className="small">{c.form.mock}</p>}<p className={`form-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{message}</p></form>;
}
