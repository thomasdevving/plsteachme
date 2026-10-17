import { ArrowRight, ShieldCheck, ArrowUpRight, BookOpen, MessageCircle, Heart } from "lucide-react";
import { pathFor, type Locale } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { Section } from "./ui";
import { StepIcons } from "./illustrations";
import { Hero } from "./hero";
import { HeroDemo } from "./hero-demo";
import { Skills } from "./skills";
import { WaitlistForm } from "./forms";
import { Mascot } from "./mascot";
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
      <HeroDemo hero={<Hero c={{ hero: c.hero }} />} c={{ demo: c.demo }} />
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
                {i === 0 && <Mascot pose="peeking" />}
                <span className="step-index">{i + 1}</span>
                <Icon size={30} strokeWidth={1.4} aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            );
          })}
        </ol>
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
        <div className="module-companion" aria-hidden="true">
          <Mascot pose="lounging" />
        </div>
      </Section>
      <Section className="scope-entry" labelledBy="scope-title">
        <div className="section-heading">
          <p className="lesson-eyebrow">Human knowledge. Help while you practice.</p>
          <h2 id="scope-title">A skill starts with someone sharing it.</h2>
          <p>Follow a learning journey, help choose the next lesson, or share a skill you know well.</p>
        </div>
        <div className="scope-cards">
          <article>
            <BookOpen aria-hidden="true" />
            <h3>Find your starting point</h3>
            <p>Explore skills for your first interview, everyday routines and independent living. Pick up where you left off.</p>
            <a className="text-link" href={pathFor(locale, "learn")}>Explore learning journeys <ArrowRight size={17} aria-hidden="true" /></a>
          </article>
          <article>
            <MessageCircle aria-hidden="true" />
            <h3>Tell us what’s missing</h3>
            <p>Request a practical skill and support ideas from other learners. Help teachers see what people want to learn.</p>
            <a className="text-link" href={pathFor(locale, "community")}>Visit the request board <ArrowRight size={17} aria-hidden="true" /></a>
          </article>
          <article>
            <Heart aria-hidden="true" />
            <h3>Share what you know</h3>
            <p>Apply to teach, add a demonstration and shape a lesson with AI assistance. An independent reviewer checks it before publication.</p>
            <a className="text-link" href={pathFor(locale, "teach")}>Open the teacher studio <ArrowRight size={17} aria-hidden="true" /></a>
          </article>
        </div>
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
            <div className="waitlist-companions" aria-hidden="true">
              <Mascot pose="sitting" color="orange" />
              <Mascot pose="cross-legged" />
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
