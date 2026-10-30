'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { Star } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/network';
import { useConnectivity } from '@/lib/offline/connectivity';
import type { FeedbackResult, LessonFeedback } from '@/lib/lesson-feedback';

function FeedbackDate({ item }: { item: LessonFeedback }) {
  const format = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return <span><time dateTime={item.createdAt}>{format(item.createdAt)}</time>{item.updatedAt !== item.createdAt && <> · Updated <time dateTime={item.updatedAt}>{format(item.updatedAt)}</time></>} · Version {item.version}</span>;
}
export function LessonFeedbackPanel({ lessonKey, version }: { lessonKey: string; version: number }) {
  const connection = useConnectivity();
  const id = useId();
  const [data, setData] = useState<FeedbackResult | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetchWithTimeout(`/api/lesson-feedback?lessonKey=${encodeURIComponent(lessonKey)}&version=${version}`, { cache: 'no-store', signal });
    if (response.status === 401) { setSignIn(true); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Feedback could not load.');
    if (signal?.aborted) return;
    setSignIn(false); setData(result);
    const own = result.own.find((item: LessonFeedback) => item.version === version);
    setRating(own?.rating || 0); setComment(own?.comment || '');
  }, [lessonKey, version]);
  useEffect(() => {
    if (!connection.online) { setLoading(false); return; }
    const abort = new AbortController(); setLoading(true); setError('');
    load(abort.signal).catch(reason => { if (!abort.signal.aborted) setError(reason.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [load, connection.online, retry]);
  const own = data?.own.find(item => item.version === version);
  async function submit(action: 'save' | 'delete', feedbackVersion = version) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetchWithTimeout('/api/lesson-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, lessonKey, version: feedbackVersion, ...(action === 'save' ? { rating, comment } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Your feedback could not be saved.');
      await load(); setMessage(action === 'save' ? 'Thank you. Your feedback is saved.' : 'Your feedback was deleted.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="lesson-feedback" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`}>How was this lesson?</h2><p className="feedback-version">Version {version}{data?.summary.count ? ` · ${data.summary.average} / 5 from ${data.summary.count} ${data.summary.count === 1 ? 'rating' : 'ratings'}` : ''}</p>
    {!connection.online ? <p role="status">Connect to the internet to read or leave feedback. Your lesson still works offline.</p>
      : loading ? <p role="status">Loading feedback…</p>
      : signIn ? <p><a className="text-link" href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/learn' : window.location.pathname)}`}>Sign in</a> with a confirmed account to rate this lesson.</p>
      : data && <><form onSubmit={event => { event.preventDefault(); void submit('save'); }}>
        <fieldset className="feedback-rating" disabled={busy}><legend>Your rating</legend><div>{[1,2,3,4,5].map(value => <label key={value} data-selected={rating >= value}><input type="radio" name={`${id}-rating`} value={value} checked={rating === value} onChange={() => setRating(value)} required /><Star size={25} fill={rating >= value ? 'currentColor' : 'none'} aria-hidden="true" /><span className="sr-only">{value} {value === 1 ? 'star' : 'stars'}</span></label>)}</div></fieldset>
        <label className="feedback-comment" htmlFor={`${id}-comment`}>Comment <span>(optional)</span></label><textarea id={`${id}-comment`} value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} rows={3} disabled={busy} placeholder="What helped? What could be clearer?" aria-describedby={`${id}-privacy`} />
        <p id={`${id}-privacy`} className="feedback-privacy">Your comment is private to you and plsteach.me, for improving lessons. Only the average rating is shared. Please leave out personal information.</p>
        <div className="feedback-actions"><button type="submit" className="button primary compact" disabled={busy || !rating}>{busy ? 'Saving…' : own ? 'Update feedback' : 'Send feedback'}</button>{own && <button type="button" className="learning-text-button" disabled={busy} onClick={() => void submit('delete')}>Delete my feedback</button>}</div>
      </form>{own && <p className="feedback-date"><FeedbackDate item={own} /></p>}
      {data.own.some(item => item.version !== version) && <details className="feedback-history"><summary>Your feedback on earlier versions</summary>{data.own.filter(item => item.version !== version).map(item => <article key={item.version}><p>{item.rating} / 5 · <FeedbackDate item={item} /></p>{item.comment && <p>{item.comment}</p>}<button type="button" className="learning-text-button" disabled={busy} onClick={() => void submit('delete', item.version)}>Delete version {item.version} feedback</button></article>)}</details>}</>}
    {message && <p role="status">{message}</p>}{error && <div role="alert"><p>{error}</p>{!data && <button type="button" className="learning-text-button" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
  </section>;
}
