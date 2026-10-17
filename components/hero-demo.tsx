"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import { DEMO_URL } from "@/lib/config";
import {
  phoneJourneyFrame,
  type PhoneJourneyGeometry,
} from "@/lib/phone-journey";
import { CoachPreview } from "./coach-preview";
import { DemoPlayer } from "./demo-player";

export function HeroDemo({
  hero,
  c,
}: {
  hero: ReactNode;
  c: Pick<Copy, "demo">;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const device = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"hero" | "moving" | "demo">("hero");

  useEffect(() => {
    const container = stage.current;
    const destination = target.current;
    const phone = device.current;
    const start = container?.querySelector<HTMLElement>(".hero-phone-anchor");
    const frame = phone?.querySelector<HTMLElement>(".phone");
    if (!container || !destination || !phone || !start || !frame) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let geometry: PhoneJourneyGeometry | undefined;
    let animationFrame = 0;
    let currentMode = "hero";
    let disposed = false;

    const paint = () => {
      animationFrame = 0;
      if (!geometry) return;
      const position = phoneJourneyFrame(
        window.scrollY,
        geometry,
        preference.matches,
      );
      phone.style.transform = `translate3d(${position.x}px,${position.y}px,0) translate(-50%,-50%) rotate(${position.angle}deg) scale(${position.scale})`;
      phone.style.setProperty("--demo-reveal", String(position.reveal));
      phone.style.setProperty("--device-scale", String(position.scale));
      phone.dataset.positioned = "true";
      phone.dataset.mode = position.mode;
      if (currentMode !== position.mode) {
        currentMode = position.mode;
        setMode(position.mode);
      }
    };
    const schedule = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(paint);
    };
    const measure = () => {
      if (disposed) return;
      phone.style.width = `${start.clientWidth}px`;
      const height = frame.offsetHeight;
      if (!height) return;
      if (Math.abs(start.offsetHeight - height) > 1)
        start.style.height = `${height}px`;
      const parent = container.getBoundingClientRect();
      const from = start.getBoundingClientRect();
      const to = destination.getBoundingClientRect();
      geometry = {
        from: {
          x: from.left + from.width / 2 - parent.left,
          y: from.top + from.height / 2 - parent.top,
        },
        to: {
          x: to.left + to.width / 2 - parent.left,
          y: to.top + to.height / 2 - parent.top,
        },
        startScroll: Math.max(
          0,
          from.top + window.scrollY + from.height / 2 - window.innerHeight / 2,
        ),
        endScroll:
          to.top + window.scrollY + to.height / 2 - window.innerHeight / 2,
        targetScale: Math.min(to.width / height, to.height / from.width),
        frameWidth: from.width,
        frameHeight: height,
        maxWidth: window.innerWidth - 40,
      };
      phone.style.setProperty("--video-width", `${height - 22}px`);
      phone.style.setProperty("--video-height", `${from.width - 22}px`);
      paint();
    };
    const resize = new ResizeObserver(measure);
    [container, start, destination, frame].forEach((node) =>
      resize.observe(node),
    );
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    preference.addEventListener("change", measure);
    const jumpToDemo = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href="#demo"]')
          : null;
      if (
        !link ||
        !geometry ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      event.preventDefault();
      history.pushState(null, "", "#demo");
      window.scrollTo({
        top: geometry.endScroll,
        behavior: preference.matches ? "instant" : "smooth",
      });
    };
    container.addEventListener("click", jumpToDemo);
    document.fonts?.ready.then(() => {
      if (!disposed) measure();
    });
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      preference.removeEventListener("change", measure);
      container.removeEventListener("click", jumpToDemo);
    };
  }, []);

  return (
    <div className="hero-demo-journey" ref={stage}>
      {hero}
      <section
        id="demo"
        className="journey-demo"
        aria-labelledby="demo-heading"
      >
        <div className="container">
          <div className="journey-demo-heading">
            <h2 id="demo-heading">{c.demo.title}</h2>
            <p>{c.demo.intro}</p>
          </div>
          <div className="demo-phone-anchor" ref={target} aria-hidden="true" />
          <div className="journey-demo-actions">
            <a className="button secondary" href={DEMO_URL}>
              {c.demo.try}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <p className="small muted">{c.demo.phone}</p>
          </div>
        </div>
      </section>
      <div className="journey-device" ref={device} data-mode={mode}>
        <CoachPreview
          suspended={mode !== "hero"}
          landscape={mode === "demo"}
          demo={<DemoPlayer active={mode === "demo"} />}
        />
      </div>
    </div>
  );
}
