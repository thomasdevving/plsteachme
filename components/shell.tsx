import Image from "next/image";
import { BRAND, pathFor, type Locale, type Page } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { MobileMenu } from "./mobile-menu";
import { BrandMark } from "./brand";
import { Mascot, MascotMotionControl } from "./mascot";
export function Header({
  c,
  locale,
  page,
}: {
  c: Copy;
  locale: Locale;
  page: Page;
}) {
  const home = pathFor(locale);
  return (
    <>
      <a className="skip-link" href="#main">
        {c.nav.skip}
      </a>
      <header className="site-header" id="top">
        <div className="container nav-inner">
          <a
            href={home}
            className="wordmark"
            aria-label={`${BRAND} — ${locale === "nl" ? "home" : "home"}`}
          >
            <BrandMark />
          </a>
          <nav aria-label={c.nav.menu} className="nav-links">
            <a href={`${home}#how`}>{c.nav.how}</a>
            <a href={`${home}#skills`}>{c.nav.skills}</a>
            <a
              href={pathFor(locale, "subscriptions")}
              aria-current={page === "subscriptions" ? "page" : undefined}
            >
              {c.nav.subscriptions}
            </a>
            <a href={pathFor(locale, "organizations")}>{c.nav.org}</a>
          </nav>
          <div className="nav-actions">
            <a className="button secondary compact nav-teacher" href="/teach">
              Become a teacher
            </a>
            <a className="button primary compact" href="/login">Log in</a>
            <MobileMenu c={c.nav} home={home} page={page} />
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer({
  c,
  locale,
  contact,
  page,
}: {
  c: Copy;
  locale: Locale;
  contact?: string;
  page: Page;
}) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-companions" aria-hidden="true">
            <Mascot pose="sitting" color="orange" />
            <Mascot pose="standing" />
          </div>
          <div className="footer-controls">
            <MascotMotionControl />
            <a href="#top">{c.footer.top} ↑</a>
          </div>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          <Image
            src="/brand/hands-filled.png"
            width={150}
            height={150}
            alt=""
          />
          <span className="brand-teach">plsteach</span>
          <span className="brand-me">.me</span>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {BRAND}
          </span>
          <a href={pathFor(locale, "learn")}>Learn</a>
          <a href={pathFor(locale, "community")}>Community</a>
          <a href={pathFor(locale, "teach")}>Teach</a>
          <a href={pathFor(locale, "training")}>Training workspace</a>
          <a href={pathFor(locale, "organizations")}>{c.nav.org}</a>
          <a href={pathFor(locale, "subscriptions")}>{c.nav.subscriptions}</a>
          <a href={pathFor(locale, "privacy")}>{c.form.privacy}</a>
          <a
            href="https://www.linkedin.com/company/plsteach-me/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
          {contact ? (
            <a href={`mailto:${contact}`}>{contact}</a>
          ) : (
            <span>{c.footer.contact}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
