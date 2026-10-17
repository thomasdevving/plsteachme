import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BRAND, SITE_URL, pathFor, pageFromSlug, type Locale } from '@/lib/config';
import { getCopy } from '@/lib/i18n';
import { mockMode } from '@/lib/storage';
import { Header, Footer } from '@/components/shell';
import { Utilities } from '@/components/utilities';
import { Landing } from '@/components/landing';
import { Organizations, DemoPage, PrivacyPage } from '@/components/pages';
import dynamic from 'next/dynamic';
const Thanks = dynamic(() => import('@/components/thanks').then(m => m.Thanks));
const Styleguide = dynamic(() => import('@/components/styleguide').then(m => m.Styleguide));
type Params = Promise<{ locale: string; slug?: string[] }>;
export function generateStaticParams() {
  return (['en'] as const).flatMap(locale => (['home','organizations','demo','privacy','thanks'] as const).map(page => ({ locale, slug: pathFor(locale,page).replace(/^\/en(?=\/|$)/,'').split('/').filter(Boolean) })));
}
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params; const locale: Locale = raw === 'en' ? 'en' : 'nl'; const page = pageFromSlug(locale,slug); const c = getCopy(locale);
  if (!page || page === 'styleguide') return { robots: { index: false, follow: false } };
  const title = { home: c.hero.title, organizations: c.org.title, demo: c.demo.pageTitle, privacy: c.legal.title, thanks: c.thanks.title }[page];
  const image = `/api/og?lang=${locale}&page=${page}`;
  return { title, description: c.meta[page], alternates: { canonical: pathFor('en',page) }, robots: { index: page !== 'thanks', follow: true }, openGraph: { type: 'website', siteName: BRAND, title, description: c.meta[page], url: pathFor(locale,page), locale: 'en_US', images: [{ url: image, width:1200, height:630, alt: title }] }, twitter: { card:'summary_large_image', title, description:c.meta[page], images:[image] } };
}
export default async function Page({ params }: { params: Params }) {
  const { locale: raw, slug } = await params; if (raw !== 'nl' && raw !== 'en') notFound(); const locale: Locale = raw; const page = pageFromSlug(locale,slug); const c = getCopy(locale); if (!page) notFound();
  const schema = [{ '@context': 'https://schema.org', '@type': 'Organization', name:BRAND, url:SITE_URL, description:c.meta.home }, ...(page === 'home' ? [{ '@context':'https://schema.org', '@type':'FAQPage', mainEntity:c.faq.items.map(item => ({ '@type':'Question', name:item.q, acceptedAnswer:{ '@type':'Answer', text:item.a } })) }] : [])];
  return <><Header c={c} locale={locale} page={page === 'styleguide' ? 'home' : page}/><main id="main">{page === 'home' ? <Landing c={c} locale={locale} mock={mockMode}/> : page === 'organizations' ? <Organizations c={c} locale={locale} mock={mockMode}/> : page === 'demo' ? <DemoPage c={c} locale={locale}/> : page === 'privacy' ? <PrivacyPage c={c}/> : page === 'thanks' ? <Thanks c={{ thanks:c.thanks,form:c.form,demo:c.demo,nav:c.nav }} locale={locale}/> : <Styleguide/>}</main><Footer c={c} locale={locale} page={page === 'styleguide' ? 'home' : page} contact={process.env.CONTACT_EMAIL}/><Utilities locale={locale}/>{process.env.NODE_ENV === 'development' && mockMode && <div className="mock-badge">Mock mode · no data stored</div>}<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({ '@context':'https://schema.org', '@graph':schema }).replace(/</g,'\\u003c')}}/></>;
}
