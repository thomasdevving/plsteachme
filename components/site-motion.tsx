"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { MOTION_KEY, setMotionPaused, useMotionPaused } from "@/lib/motion-preference";

/** Shared animation preference and visibility tracking for ambient artwork. */
export function SiteMotion() {
  const paused = useMotionPaused();
  const pathname = usePathname();

  useEffect(() => {
    const read = () => {
      let saved = false;
      try { saved = localStorage.getItem(MOTION_KEY) === "true"; } catch { /* Private browsing. */ }
      setMotionPaused(saved, false);
    };
    const storage = (event: StorageEvent) => { if (event.key === MOTION_KEY || event.key === null) read(); };
    read();
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
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

  return <button className="site-motion-control" type="button" aria-label={paused ? "Resume animations" : "Pause animations"} aria-pressed={paused} onClick={() => setMotionPaused(!paused)}>
    {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
    <span>{paused ? "Resume animations" : "Pause animations"}</span>
  </button>;
}
