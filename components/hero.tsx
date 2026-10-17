import type { Copy } from "@/lib/i18n";
import { Cta } from "./utilities";
import { Mascot } from "./mascot";

export function Hero({ c }: { c: Pick<Copy, "hero"> }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <h1>
            <span>A tutorial shows </span>
            <span>
              you, <span className="brand-teach">plsteach</span>
              <span className="brand-me">.me </span>
            </span>
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
            <div className="mascot-button">
              <Mascot pose="waving" />
              <Cta href="#demo" kind="demo" secondary>
                {c.hero.secondary}
              </Cta>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-phone-anchor" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
