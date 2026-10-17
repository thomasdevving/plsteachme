"use client";
import { useEffect } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";
export function Utilities() {
  useEffect(() => {
    // Remove campaign data saved by earlier versions. No tracking is started.
    try { sessionStorage.removeItem('plsteach:attribution'); } catch { /* Storage may be blocked. */ }
  }, []);
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
