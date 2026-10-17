"use client";

import { useEffect, useState } from "react";
import type { Copy } from "@/lib/i18n";
import type { Page } from "@/lib/config";
import { fetchWithTimeout } from "@/lib/network";
import { MobileMenu } from "./mobile-menu";

export function AccountNavigation({ c, home, page }: {
  c: Copy["nav"];
  home: string;
  page: Page;
}) {
  // Unknown is deliberately neutral: a slow connection is not a signed-out user.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetchWithTimeout("/api/auth/session", {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!response.ok) return;
        const account = await response.json();
        if (!abort.signal.aborted && "user" in account) setSignedIn(Boolean(account.user));
      } catch {
        // Keep the last confirmed state during temporary service failures.
      } finally {
        pending = false;
      }
    }
    void refresh();
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      abort.abort();
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const accountHref = signedIn === false ? "/login" : "/account";
  const accountLabel = signedIn === null ? "Account" : signedIn ? "My account" : "Log in";
  return (
    <div className="nav-actions">
      <a className="button secondary compact nav-teacher" href="/teach">Become a teacher</a>
      <a className="button primary compact" href={accountHref}>{accountLabel}</a>
      <MobileMenu c={c} home={home} page={page} accountHref={accountHref} accountLabel={accountLabel} />
    </div>
  );
}
