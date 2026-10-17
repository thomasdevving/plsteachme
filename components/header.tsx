import Link from "next/link";
import { BrandMark } from "./brand";
import { ArrowLeft } from "lucide-react";
import { copy, liveCopy as c } from "@/lib/copy/en";
export function Header({
  backHref,
  backLabel = copy.common.back,
  current,
}: {
  backHref?: string;
  backLabel?: string;
  current?: 'modules' | 'guide' | 'progress' | 'settings';
}) {
  return (
    <header className="site-header">
      <Link
        href="/"
        className="wordmark"
        aria-label={`${copy.brand} — ${copy.common.home}`}
      >
        <BrandMark />
      </Link>
      {backHref ? (
        <Link href={backHref} className="quiet-link">
          <ArrowLeft size={20} aria-hidden="true" />
          {backLabel}
        </Link>
      ) : (
        <nav className="header-links" aria-label={c.navMain}>
          <Link href="/coach" aria-current={current === 'modules' ? 'page' : undefined}>Modules</Link>
          <Link href="/coach/guide" aria-current={current === 'guide' ? 'page' : undefined}>Guide</Link>
          <Link href="/account">Account</Link>
          <Link href="/coach/progress" aria-current={current === 'progress' ? 'page' : undefined}>{c.navProgress}</Link>
          <Link href="/coach/settings" aria-current={current === 'settings' ? 'page' : undefined}>{c.navSettings}</Link>
        </nav>
      )}
    </header>
  );
}
