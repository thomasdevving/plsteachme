import type { Copy } from "@/lib/i18n";
import { CoachPreview } from "./coach-preview";
import { Cta } from "./utilities";

export function Hero({ c }: { c: Pick<Copy, "hero"> }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <h1>
            <span>A tutorial shows </span>
            <span>you, <span className="hero-emphasis">plsteach.me </span></span>
            <span className="hero-emphasis">guides you.</span>
          </h1>
          <div className="hero-description">
            <p>{c.hero.sub}</p>
            <p className="hero-emphasis">{c.hero.support}</p>
          </div>
          <div className="hero-actions">
            <Cta href="#waitlist" kind="waitlist">
              {c.hero.primary}
            </Cta>
            <Cta href="#demo" kind="demo" secondary>
              {c.hero.secondary}
            </Cta>
          </div>
        </div>
        <div className="hero-visual">
          <CoachPreview hero={c.hero} />
        </div>
      </div>
    </section>
  );
}
