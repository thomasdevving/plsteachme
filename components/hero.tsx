import type { Copy } from "@/lib/i18n";
import { Cta } from "./utilities";
import { Mascot } from "./mascot";
import { ArrowUpRight } from "lucide-react";

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
            <span className="hero-emphasis">guides you.<svg className="hero-underline" viewBox="0 0 380 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 12Q105 0 210 9T377 6M22 17Q165 9 338 16"/></svg></span>
          </h1>
          <div className="hero-description">
            <p>{c.hero.sub}</p>
            <p className="hero-emphasis">{c.hero.support}</p>
          </div>
          <div className="hero-actions">
            <a className="button primary" href="/learn">Start learning<ArrowUpRight size={18} aria-hidden="true"/></a>
            <div className="mascot-button">
              <Mascot pose="waving" />
              <Cta href="#demo" kind="demo" secondary>
                {c.hero.secondary}
              </Cta>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit" data-ambient aria-hidden="true"/>
          <div className="hero-phone-anchor" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
