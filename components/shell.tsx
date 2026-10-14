import Image from 'next/image';
import { BRAND, pathFor, type Locale, type Page } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { Cta } from './utilities';
import { BrandMark } from './brand';
export function Header({ c, locale, page }: { c: Copy; locale: Locale; page: Page }) {
  const home = pathFor(locale);
  return <><a className="skip-link" href="#main">{c.nav.skip}</a><header className="site-header" id="top"><div className="container nav-inner"><a href={home} className="wordmark" aria-label={`${BRAND} — ${locale === 'nl' ? 'home' : 'home'}`}><BrandMark/></a><nav aria-label={c.nav.menu} className="nav-links"><a href={`${home}#how`}>{c.nav.how}</a><a href={`${home}#skills`}>{c.nav.skills}</a><a href={pathFor(locale, 'organizations')}>{c.nav.org}</a></nav><div className="nav-actions"><a className="button secondary compact" href="/coach">Try the coach</a><Cta href={`${home}#waitlist`} kind="waitlist" compact>{c.nav.join}</Cta></div></div></header></>;
}
export function Footer({ c, locale, contact, page }: { c: Copy; locale: Locale; contact?: string; page: Page }) {
  return <footer className="site-footer"><div className="container"><div className="footer-top"><p>{c.footer.mission}</p><a href="#top">{c.footer.top} ↑</a></div><div className="footer-wordmark" aria-hidden="true"><Image src="/brand/hands-filled.png" width={150} height={150} alt=""/><span className="brand-teach">plsteach</span><span className="brand-me">.me</span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {BRAND}</span><a href={pathFor(locale, 'organizations')}>{c.nav.org}</a><a href={pathFor(locale,'privacy')}>{c.form.privacy}</a>{contact ? <a href={`mailto:${contact}`}>{contact}</a> : <span>{c.footer.contact}</span>}</div></div></footer>;
}
