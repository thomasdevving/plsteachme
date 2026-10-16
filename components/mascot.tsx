"use client";

import { useEffect, useRef } from "react";

/** Decorative, separately articulated heads from the supplied clay characters. */
export function Mascot({ pose }: { pose: "hanging" | "standing" }) {
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
      className={`mascot mascot--${pose}`}
      aria-hidden="true"
      data-active="false"
    >
      <span className="mascot-body" />
      <span className="mascot-head" />
    </span>
  );
}
