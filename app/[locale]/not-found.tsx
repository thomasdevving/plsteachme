'use client';
import { BrandMark } from '@/components/brand';
import { missingCopy } from '@/messages/not-found';
import { pathFor } from '@/lib/config';
export default function NotFound() {
 const locale = 'en'; const c=missingCopy.en;
 return <><header className="site-header"><div className="container nav-inner"><a className="wordmark" href={pathFor(locale)}><BrandMark/></a></div></header><main id="main"><section className="missing-page container"><h1>{c.title}</h1><p className="lead">{c.body}</p><a className="button primary" href={pathFor(locale)}>{c.action}</a></section></main></>;
}
