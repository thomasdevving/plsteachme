'use client';
import { missingCopy } from '@/messages/not-found';
import { BRAND, pathFor } from '@/lib/config';
export default function NotFound() {
 const locale = 'en'; const c=missingCopy.en;
 return <><header className="site-header"><div className="container nav-inner"><a className="wordmark" href={pathFor(locale)}><img className="brand-logo" src="/brand/hands.png" width="44" height="44" alt=""/><span className="brand-teach">plsteach</span><span className="brand-me">.me</span></a></div></header><main id="main"><section className="missing-page container"><h1>{c.title}</h1><p className="lead">{c.body}</p><a className="button primary" href={pathFor(locale)}>{c.action}</a></section></main></>;
}
