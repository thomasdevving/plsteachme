"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MOTION_KEY, setMotionPaused } from "@/lib/motion-preference";

/** Visibility tracking for ambient artwork. */
export function SiteMotion() {
  const pathname = usePathname();

  // Animations always run (the OS reduced-motion setting still applies); an
  // earlier stored "paused" choice from the removed control is cleared.
  useEffect(() => {
    try { localStorage.removeItem(MOTION_KEY); } catch { /* Private browsing. */ }
    setMotionPaused(false, false);
  }, []);

  useEffect(() => {
    const sync = () => {
      document.documentElement.dataset.pageHidden = String(document.hidden);
    };
    sync();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        (entry.target as HTMLElement).dataset.active = String(entry.isIntersecting);
      }
    }, { threshold: .08, rootMargin: "0px 0px -24px 0px" });
    document.querySelectorAll("[data-ambient]").forEach(element => observer.observe(element));
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [pathname]);

  return null;
}
