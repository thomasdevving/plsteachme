import { ArrowRight, Check } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import { pathFor, type Locale } from "@/lib/config";

export function Subscriptions({ c, locale }: { c: Copy; locale: Locale }) {
  return (
    <div className="container subscriptions-page">
      <header className="subscriptions-intro">
        <h1>{c.subscriptions.title}</h1>
        <p className="lead">{c.subscriptions.intro}</p>
      </header>
      <section
        aria-label="Planned subscription levels"
        className="subscription-plans"
      >
        {c.subscriptions.plans.map((plan, index) => (
          <article
            className={`subscription-plan ${index === 1 ? "plan-plus" : ""}`}
            key={plan.name}
            aria-labelledby={`plan-${index}`}
          >
            <h2 id={`plan-${index}`}>{plan.name}</h2>
            <p className="plan-description">{plan.description}</p>
            <div className="plan-price">
              <p>Coming soon</p>
              <span>Pricing to be announced</span>
            </div>
            <h3>What we’re planning</h3>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={18} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <a
              className={`button ${index === 1 ? "primary" : "secondary"}`}
              href={
                index === 2
                  ? pathFor(locale, "organizations") + "#pilot"
                  : pathFor(locale) + "#waitlist"
              }
            >
              {plan.action}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </article>
        ))}
      </section>
      <p className="subscription-note">{c.subscriptions.note}</p>
      <section
        className="subscription-demo"
        aria-labelledby="subscription-demo-title"
      >
        <div>
          <h2 id="subscription-demo-title">Start with a skill today.</h2>
          <p>The early coaching demo is free to try.</p>
        </div>
        <a className="text-link" href="/coach">
          Try the coach
          <ArrowRight size={19} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
