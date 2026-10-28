"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { fetchWithTimeout } from "@/lib/network";
import { PROFILE_UPDATED_EVENT, type AccountProfile } from "@/lib/auth/profile";

export function AccountNavLink({
  className = "",
  learning = false,
}: {
  className?: string;
  learning?: boolean;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("My account");
  useEffect(() => {
    const abort = new AbortController();
    let version = 0;
    async function load() {
      const requestVersion = ++version;
      try {
        const response = await fetchWithTimeout("/api/auth/session", {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!response.ok) return;
        const session = await response.json();
        if (abort.signal.aborted || requestVersion !== version) return;
        setSignedIn(Boolean(session.user));
        if (!session.user) return;
        const profileResponse = await fetchWithTimeout("/api/profile", {
          cache: "no-store",
          signal: abort.signal,
        });
        if (!profileResponse.ok) return;
        const { profile } = (await profileResponse.json()) as {
          profile: AccountProfile | null;
        };
        if (!abort.signal.aborted && requestVersion === version)
          setName(
            profile?.username ||
              [profile?.firstName, profile?.lastName]
                .filter(Boolean)
                .join(" ") ||
              "My account",
          );
      } catch {
        /* Keep an account link during an outage; never mislabel a known session as signed out. */
      }
    }
    void load();
    const refresh = () => {
      void load();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, refresh);
    return () => {
      abort.abort();
      window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
    };
  }, []);
  const label = signedIn === false ? "Log in" : signedIn ? name : "Account";
  return (
    <Link
      className={className}
      href={
        signedIn === false
          ? learning
            ? "/login?next=%2Flearn"
            : "/login"
          : "/account"
      }
      title={label}
    >
      {learning && <UserRound size={18} aria-hidden="true" />}
      <span>{label}</span>
    </Link>
  );
}
