'use client';
import { useEffect } from 'react';
import { BrandMark } from '@/components/brand';
import { pathFor } from '@/lib/config';
// Shown when a page fails to render. The error details stay in the server logs.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
 useEffect(() => { console.error('page.error', error.digest || error.name); }, [error]);
 return <><header className="site-header"><div className="container nav-inner"><a className="wordmark" href={pathFor('en')}><BrandMark/></a></div></header><main id="main"><section className="missing-page container"><h1>Something went wrong.</h1><p className="lead">This page could not load. Please try again in a moment.{error.digest ? ` (Reference ${error.digest})` : ''}</p><div className="hero-actions"><button className="button primary" onClick={reset}>Try again</button><a className="button secondary" href={pathFor('en')}>Go to the homepage</a></div></section></main></>;
}
