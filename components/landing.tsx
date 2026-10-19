import { ArrowRight, ArrowUpRight, BookOpen, MessageCircle, Heart } from "lucide-react";
import { pathFor, type Locale } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { Section } from "./ui";
import { StepIcons } from "./illustrations";
import { Hero } from "./hero";
import { HeroDemo } from "./hero-demo";
import { Skills } from "./skills";
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
    <div className="creative-home">
      <HeroDemo hero={<Hero c={{ hero: c.hero }} />} c={{ demo: c.demo }} />
      <Section id="how" className="practice-method" labelledBy="how-title">
        <div className="section-heading">
          <h2 id="how-title">{c.how.title}</h2>
          <p>Follow each lesson step, watch the demonstration, and practice at your own pace.</p>
          <a href="/learn" className="text-link method-link">Let’s find your first skill<ArrowRight size={18} aria-hidden="true"/></a>
        </div>
        <ol className="steps">
          {c.how.steps.map((step, i) => {
            const Icon = StepIcons[i];
            return (
              <li key={step.title}>
                {i === 0 && <Mascot pose="peeking" />}
                <span className="step-index">0{i + 1}</span>
                <Icon size={30} strokeWidth={1.4} aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            );
          })}
        </ol>
      </Section>
      <Section id="skills" className="creative-skills" labelledBy="skills-title">
        <div className="section-heading">
          <h2 id="skills-title">{c.skills.title}</h2>
          <p>{c.skills.intro}</p>
          <a href="/learn" className="text-link collection-link">Explore the whole library<ArrowUpRight size={18} aria-hidden="true"/></a>
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
          <h2 id="scope-title">Request a skill or share what you know.</h2>
          <p>Follow a learning journey, help choose the next lesson, or share a skill you know well.</p>
        </div>
        <div className="scope-cards">
          <article>
            <span className="scope-card-index" aria-hidden="true">01</span>
            <BookOpen aria-hidden="true" />
            <h3>Find your starting point</h3>
            <p>Explore skills for your first interview, everyday routines and independent living. Pick up where you left off.</p>
            <a className="text-link" href={pathFor(locale, "learn")}>Explore learning journeys <ArrowRight size={17} aria-hidden="true" /></a>
          </article>
          <article>
            <span className="scope-card-index" aria-hidden="true">02</span>
            <MessageCircle aria-hidden="true" />
            <h3>Tell us what’s missing</h3>
            <p>Request a practical skill and support ideas from other learners. Help teachers see what people want to learn.</p>
            <a className="text-link" href={pathFor(locale, "community")}>Visit the request board <ArrowRight size={17} aria-hidden="true" /></a>
          </article>
          <article>
            <span className="scope-card-index" aria-hidden="true">03</span>
            <Heart aria-hidden="true" />
            <h3>Share what you know</h3>
            <p>Apply to teach, add a demonstration and shape a lesson with AI assistance. An independent reviewer checks it before publication.</p>
            <a className="text-link" href={pathFor(locale, "teach")}>Open the teacher studio <ArrowRight size={17} aria-hidden="true" /></a>
          </article>
        </div>
      </Section>
      <Section className="privacy-section" labelledBy="privacy-title">
        <div className="privacy-heading">
          <div className="section-heading">
          <div className="privacy-companion"><Mascot pose="inspecting" /></div>
          <h2 id="privacy-title">{c.privacy.title}</h2>
          </div>
        </div>
        <div className="privacy-details">
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
        </div>
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
      <Section labelledBy="faq-title">
        <div className="faq-layout">
          <div><h2 id="faq-title">{c.faq.title}</h2></div>
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
    </div>
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
