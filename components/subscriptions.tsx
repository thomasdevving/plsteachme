import { ArrowRight, Check } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import { pathFor, type Locale } from "@/lib/config";
import { Mascot } from "./mascot";

export function Subscriptions({ c, locale }: { c: Copy; locale: Locale; mock?: boolean }) {
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
            {index === 1 && <Mascot pose="peeking" />}
            <p className="plan-availability">{c.subscriptions.comingSoon}</p>
            <h2 id={`plan-${index}`}>{plan.name}</h2>
            <p className="plan-description">{plan.description}</p>
            <div className="plan-price">
              <p>{plan.price}</p>
              <span>{c.subscriptions.billing}</span>
              <small className="plan-price-note">{plan.priceNote}</small>
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
                  : "/signup?next=%2Flearn"
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
          <h2 id="subscription-demo-title">Your first skill is free.</h2>
          <p>plsteach.me is live in beta. Start with any lesson today.</p>
        </div>
        <a className="text-link" href="/learn">
          Start learning
          <ArrowRight size={19} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
