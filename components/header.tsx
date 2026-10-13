import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { copy, liveCopy as c } from "@/lib/copy/en";
export function Header({
  backHref,
  backLabel = copy.common.back,
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="site-header">
      <Link
        href="/"
        className="wordmark"
        aria-label={`${copy.brand} — ${copy.common.home}`}
      >
        pls<span>teach</span>.me
        <span className="brand-dot" aria-hidden="true" />
      </Link>
      {backHref ? (
        <Link href={backHref} className="quiet-link">
          <ArrowLeft size={20} aria-hidden="true" />
          {backLabel}
        </Link>
      ) : (
        <nav className="header-links" aria-label={c.navMain}>
          <Link href="/progress">{c.navProgress}</Link>
          <Link href="/settings">{c.navSettings}</Link>
        </nav>
      )}
    </header>
  );
}
