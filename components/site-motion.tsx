"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { MOTION_EVENT, MOTION_KEY, motionIsPaused, setMotionPaused, useMotionPaused } from "@/lib/motion-preference";

/** Small progressive enhancements: content remains visible before JavaScript. */
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
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const stop = () => { animations.forEach(animation => animation.cancel()); animations.clear(); };
    const sync = () => {
      document.documentElement.dataset.pageHidden = String(document.hidden);
      if (motionIsPaused() || preference.matches || document.hidden) stop();
    };
    sync();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target.hasAttribute("data-ambient")) { (entry.target as HTMLElement).dataset.active = String(entry.isIntersecting); continue; }
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (motionIsPaused() || preference.matches || document.hidden || !entry.target.animate) continue;
        const animation = entry.target.animate(
          [{ transform: "translateY(26px)" }, { transform: "translateY(0)" }],
          { duration: 700, delay: Number((entry.target as HTMLElement).dataset.revealDelay || 0), easing: "cubic-bezier(.2,.75,.25,1)" },
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: .08, rootMargin: "0px 0px -24px 0px" });
    document.querySelectorAll("[data-reveal],[data-ambient]").forEach(element => observer.observe(element));
    window.addEventListener(MOTION_EVENT, sync);
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect(); stop();
      window.removeEventListener(MOTION_EVENT, sync);
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [pathname]);

  return <button className="site-motion-control" type="button" aria-label={paused ? "Resume animations" : "Pause animations"} aria-pressed={paused} onClick={() => setMotionPaused(!paused)}>
    {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
    <span>{paused ? "Resume animations" : "Pause animations"}</span>
  </button>;
}
