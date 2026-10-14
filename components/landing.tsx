import {
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { pathFor, type Locale } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { Section } from "./ui";
import { StepIcons } from "./illustrations";
import { Hero } from "./hero";
import { Demo } from "./demo";
import { Skills } from "./skills";
import { WaitlistForm } from "./forms";
export function Landing({
  c,
  locale,
  mock,
}: {
  c: Copy;
  locale: Locale;
  mock: boolean;
}) {
  return (
    <>
      <Hero c={{ hero: c.hero, skills: c.skills }} />
      <Section className="problem" labelledBy="problem-title">
        <div className="problem-layout">
          <h2 id="problem-title">{c.problem.title}</h2>
          <div className="story">
            {c.problem.beats.map((beat) => (
              <p key={beat}>{beat}</p>
            ))}
          </div>
        </div>
      </Section>
      <Section id="how" labelledBy="how-title">
        <div className="section-heading">
          <h2 id="how-title">{c.how.title}</h2>
          <p>{c.how.intro}</p>
        </div>
        <ol className="steps">
          {c.how.steps.map((step, i) => {
            const Icon = StepIcons[i];
            return (
              <li key={step.title}>
                <span className="step-index">{i + 1}</span>
                <Icon size={30} strokeWidth={1.4} aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            );
          })}
        </ol>
      </Section>
      <Section id="demo" className="demo-section" labelledBy="demo-heading">
        <h2 id="demo-heading" className="sr-only">
          {c.hero.secondary}
        </h2>
        <Demo c={{ demo: c.demo }} />
      </Section>
      <Section id="skills" labelledBy="skills-title">
        <div className="section-heading">
          <h2 id="skills-title">{c.skills.title}</h2>
          <p>{c.skills.intro}</p>
        </div>
        <Skills
          c={{ skills: c.skills, form: c.form, demo: c.demo }}
          locale={locale}
        />
      </Section>
      <Section className="privacy-section" labelledBy="privacy-title">
        <div className="section-heading">
          <ShieldCheck size={35} strokeWidth={1.25} aria-hidden="true" />
          <h2 id="privacy-title">{c.privacy.title}</h2>
        </div>
        <ul className="privacy-points">
          {c.privacy.points.map((point) => (
            <li key={point}>
              <CheckMark />
              {point}
            </li>
          ))}
        </ul>
        <p className="small muted">{c.privacy.scope}</p>
        <a className="text-link" href={pathFor(locale, "privacy")}>
          {c.privacy.link}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </Section>
      <Section className="org-teaser" labelledBy="org-title">
        <div>
          <h2 id="org-title">{c.org.teaser}</h2>
          <p>{c.org.teaserBody}</p>
        </div>
        <a className="button secondary" href={pathFor(locale, "organizations")}>
          {c.org.cta}
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </Section>
      <Section
        id="waitlist"
        className="waitlist-section"
        labelledBy="waitlist-title"
      >
        <div className="waitlist-layout">
          <div className="waitlist-copy">
            <h2 id="waitlist-title">{c.form.title}</h2>
            <p className="lead">{c.form.intro}</p>
            <div className="waitlist-art" aria-hidden="true">
              <MessageCircle size={110} strokeWidth={0.8} />
              <span>*</span>
            </div>
          </div>
          <WaitlistForm
            c={{ form: c.form, skills: c.skills }}
            locale={locale}
            mock={mock}
          />
        </div>
      </Section>
      <Section labelledBy="faq-title">
        <div className="faq-layout">
          <h2 id="faq-title">{c.faq.title}</h2>
          <div className="faq-items">
            {c.faq.items.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
