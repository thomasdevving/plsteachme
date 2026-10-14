"use client";
import { useRef } from "react";
import { Menu, X } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import type { Page } from "@/lib/config";

export function MobileMenu({
  c,
  home,
  page,
}: {
  c: Copy["nav"];
  home: string;
  page: Page;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  function close() {
    if (menu.current) menu.current.open = false;
  }
  return (
    <details
      className="mobile-menu"
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
          menu.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Navigation menu">
        <Menu className="menu-open" size={22} aria-hidden="true" />
        <X className="menu-close" size={22} aria-hidden="true" />
      </summary>
      <nav
        aria-label="Mobile navigation"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) close();
        }}
      >
        <a href={`${home}#how`}>{c.how}</a>
        <a href={`${home}#skills`}>{c.skills}</a>
        <a
          href="/subscriptions"
          aria-current={page === "subscriptions" ? "page" : undefined}
        >
          {c.subscriptions}
        </a>
        <a
          href="/organizations"
          aria-current={page === "organizations" ? "page" : undefined}
        >
          {c.org}
        </a>
        <a href={`${home}#waitlist`}>{c.join}</a>
      </nav>
    </details>
  );
}
