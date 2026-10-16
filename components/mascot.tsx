"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/** Decorative, separately articulated heads from the supplied clay characters. */
export function Mascot({
  pose,
  color = "green",
}: {
  pose: "sitting" | "standing";
  color?: "orange" | "green";
}) {
  const character = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = character.current;
    if (!node) return;
    let visible = false;
    const sync = () => {
      node.dataset.active = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <span
      ref={character}
      className={`mascot mascot--${pose} mascot--${color}`}
      aria-hidden="true"
      data-active="false"
    >
      <span className="mascot-body" />
      <span className="mascot-head" />
    </span>
  );
}

export function MascotMotionControl() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.mascotsPaused = String(paused);
    return () => {
      delete document.documentElement.dataset.mascotsPaused;
    };
  }, [paused]);
  return (
    <button
      className="mascot-motion-control"
      type="button"
      onClick={() => setPaused((value) => !value)}
      aria-label={
        paused ? "Resume character animations" : "Pause character animations"
      }
    >
      {paused ? (
        <Play size={13} aria-hidden="true" />
      ) : (
        <Pause size={13} aria-hidden="true" />
      )}
      {paused ? "Resume characters" : "Pause characters"}
    </button>
  );
}
