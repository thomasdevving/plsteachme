'use client';
import { fetchWithTimeout } from '@/lib/network';
import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Check, Share2, MessageCircle } from 'lucide-react';
import type { Copy as Messages } from '@/lib/i18n';
import { BRAND, pathFor, type Locale } from '@/lib/config';
import { track } from '@/lib/analytics';
import { Mascot } from './mascot';
export function Thanks({ c, locale }: { c: Pick<Messages,'thanks'|'form'|'demo'|'nav'>; locale: Locale }) {
  const [session,setSession] = useState<{ mock?: boolean; referral?: string } | null>(null); const [link,setLink] = useState(''); const [copied,setCopied] = useState(false); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false); const [saved,setSaved] = useState(false); const [native,setNative] = useState(false);
  useEffect(() => { setNative(!!navigator.share); fetchWithTimeout('/api/session', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setSession(data); if (data.referral) setLink(`${location.origin}${pathFor(locale)}?ref=${encodeURIComponent(data.referral)}`); }).catch(() => { setSession({}); setMessage(c.form.error); }); }, [locale,c.form.error]);
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true); track('share_click', { method: 'copy' }); } catch { setMessage(c.form.error); } }
  async function share() { try { await navigator.share({ title: BRAND, text: c.thanks.shareText, url: link }); track('share_click', { method: 'native' }); } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setMessage(c.form.error); } }
  async function followup(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const values = new FormData(e.currentTarget); setMessage(''); const { followupSchema } = await import('@/lib/validation'); const data = followupSchema.safeParse({ answer: values.get('answer'), website: '' }); if (!data.success) { setMessage(c.form.required); return; } setBusy(true); try { const res = await fetchWithTimeout('/api/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.data) }); if (!res.ok) throw new Error(); setSaved(true); } catch { setMessage(c.form.error); } finally { setBusy(false); } }
  const intro=(title:string,description?:string)=><header className="thanks-intro">
    <div className="thanks-heading-row"><h1>{title}</h1><div className="thanks-mascot"><Mascot pose="waving"/></div></div>
    {description&&<p className="lead">{description}</p>}
  </header>;
  return <div className="thanks-content">
    {!session?<p role="status">{c.form.submitting}</p>:session.mock?<>
      {intro(c.thanks.mockTitle,c.thanks.mockBody)}
      <a className="button primary" href={pathFor(locale)}>{c.demo.back}</a>
    </>:<>
      {intro(c.thanks.title,c.thanks.intro)}
      {link?<div className="thanks-panels">
        <section className="thanks-request" aria-labelledby="request-title">
          <h2 id="request-title">{c.thanks.question}</h2>
          <form className="followup" onSubmit={followup}>
            {saved?<p role="status" className="thanks-saved"><Check size={19} aria-hidden="true"/>{c.thanks.saved}</p>:<>
              <label className="sr-only" htmlFor="answer">{c.thanks.question}</label>
              <textarea name="answer" id="answer" maxLength={1000} rows={3} placeholder={c.thanks.placeholder} required/>
              <button type="submit" className="button primary" disabled={busy}>{busy?c.form.submitting:c.thanks.send}</button>
            </>}
          </form>
        </section>
        <section className={`thanks-sharing${native?' has-native-share':''}`} aria-labelledby="share-title">
          <h2 id="share-title">{c.thanks.share}</h2>
          <label className="sr-only" htmlFor="referral">Your personal invitation link</label>
          <input id="referral" readOnly value={link}/>
          <div className="share-buttons">
            <button type="button" className="button secondary" onClick={copy}>{copied?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}{copied?c.thanks.copied:c.thanks.copy}</button>
            <a className="button secondary thanks-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${c.thanks.shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer" aria-label={c.thanks.whatsapp} onClick={()=>track('share_click',{method:'whatsapp'})}><MessageCircle size={18} aria-hidden="true"/><span className="thanks-share-label">{c.thanks.whatsapp}</span></a>
            {native&&<button type="button" className="button secondary" onClick={share} aria-label={c.thanks.native}><Share2 size={18} aria-hidden="true"/><span className="thanks-share-label">{c.thanks.native}</span></button>}
          </div>
        </section>
      </div>:<p>{c.thanks.noSignup} <a href="/signup">Join the waitlist</a></p>}
    </>}
    {message&&<p role="status" className="thanks-message">{message}</p>}
  </div>;
}
