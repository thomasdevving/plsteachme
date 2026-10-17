"use client";
import { useEffect } from "react";
import Script from "next/script";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { attribution } from "@/lib/attribution";
import { track } from "@/lib/analytics";
import { type Locale } from "@/lib/config";
export function Utilities({ locale }: { locale: Locale }) {
  useEffect(() => {
    attribution(locale);
  }, [locale]);
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (provider === "plausible" && domain)
    return (
      <Script
        defer
        data-domain={domain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  const script = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  if (
    provider === "umami" &&
    script &&
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  )
    return (
      <Script
        defer
        data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
        src={script}
        strategy="afterInteractive"
      />
    );
  return null;
}
export function Cta({
  href,
  children,
  kind,
  secondary = false,
  compact = false,
}: {
  href: string;
  children: React.ReactNode;
  kind: "waitlist" | "demo";
  secondary?: boolean;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={() =>
        track(kind === "waitlist" ? "cta_waitlist_click" : "cta_demo_click")
      }
      className={`button ${secondary ? "secondary" : "primary"} ${compact ? "compact" : ""}`}
    >
      {children}
      {!compact &&
        (secondary ? (
          <ArrowRight size={18} aria-hidden="true" />
        ) : (
          <ArrowUpRight size={18} aria-hidden="true" />
        ))}
    </a>
  );
}
