"use client";
import { useEffect } from "react";
import "@/lib/pwa/install";
import { removeAllPackages } from "@/lib/offline/packages";

/**
 * Registers the one service worker for the whole site. Older builds registered
 * it only for /coach/; that registration is removed so two workers never compete.
 * Development never runs a service worker, so a stale production worker cannot
 * take over `next dev`.
 */
export function PWA() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    void (async () => {
      try {
        const registrations = await container.getRegistrations();
        if (process.env.NODE_ENV !== "production") {
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if (registrations.length) await removeAllPackages().catch(() => {});
          return;
        }
        const root = new URL("/", window.location.origin).href;
        await Promise.all(registrations.filter((registration) => registration.scope !== root).map((registration) => registration.unregister()));
        await container.register("/sw.js", { scope: "/", updateViaCache: "none" });
      } catch {
        /* Without a service worker the site keeps working online. */
      }
    })();
  }, []);
  return null;
}
