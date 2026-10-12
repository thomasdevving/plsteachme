import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { copy } from "@/lib/copy/en";
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
        <span className="header-note">{copy.home.available}</span>
      )}
    </header>
  );
}
