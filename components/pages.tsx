import { ArrowUpRight, Users, BookOpen, Briefcase } from 'lucide-react';
import { pathFor, type Locale } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { Section, Button, Card, Chip, FormField } from './ui';
import { OrganizationForm } from './forms';
import { Demo } from './demo';
import { LessonLibrary } from './lesson-player';
export function Organizations({ c, locale, mock }: { c: Copy; locale: Locale; mock: boolean }) {
  const icons = [Users,BookOpen,Briefcase];
  return <><section className="subpage-hero container"><h1>{c.org.title}</h1><p className="lead">{c.org.intro}</p><p>{c.org.body}</p><a className="button primary" href="#pilot">{c.org.cta}<ArrowUpRight size={18} aria-hidden="true"/></a><p className="early-note">{c.org.early}</p></section><Section className="org-cases"><div className="use-cases">{c.org.useCases.map((item,i) => { const Icon = icons[i]; return <article key={item.title}><Icon size={35} strokeWidth={1.25} aria-hidden="true"/><h2>{item.title}</h2><p>{item.body}</p></article>; })}</div></Section><Section id="pilot" className="pilot-section"><div className="waitlist-layout"><div><h2>{c.org.formTitle}</h2><p className="lead">{c.org.formIntro}</p></div><OrganizationForm c={{ form:c.form,org:c.org }} locale={locale} mock={mock}/></div></Section></>;
}
export function DemoPage({ c, locale }: { c: Copy; locale: Locale }) { return <Section className="demo-page"><h1>Pick a skill. Follow it through.</h1><p className="lead">Nine illustrated walkthroughs. Take each step at your own pace.</p><div id="lessons"><LessonLibrary names={c.skills.names}/></div><Demo c={{ demo:c.demo }}/><a href={pathFor(locale)} className="text-link">← {c.demo.back}</a></Section>; }
export function PrivacyPage({ c }: { c: Copy }) { return <article className="legal-page container"><h1>{c.legal.title}</h1><p className="draft-note">{c.legal.draft}</p>{c.legal.sections.map(s => <section key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}</article>; }
export function MissingPage({ c, locale }: { c: Copy; locale: Locale }) { return <section className="missing-page container"><h1>{c.notFound.title}</h1><p className="lead">{c.notFound.body}</p><a className="button primary" href={pathFor(locale)}>{c.notFound.action}</a></section>; }
