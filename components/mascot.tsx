"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { mascotFrames, mascotFrameStyle } from "@/lib/mascot-frames";

const illustratedPoses = mascotFrames;
type MascotPose = "sitting" | "standing" | keyof typeof illustratedPoses;

/** Decorative clay poses; each illustration has its own grounded motion. */
export function Mascot({
  pose,
  color = "green",
}: {
  pose: MascotPose;
  color?: "orange" | "green";
}) {
  const character = useRef<HTMLSpanElement>(null);
  const illustrated = pose in illustratedPoses;
  const characterColor = illustrated
    ? illustratedPoses[pose as keyof typeof illustratedPoses].color
    : color;

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
      className={`mascot mascot--${pose} mascot--${characterColor}`}
      style={
        illustrated
          ? mascotFrameStyle(pose as keyof typeof mascotFrames)
          : undefined
      }
      aria-hidden="true"
      data-active="false"
    >
      {illustrated ? (
        <span className="mascot-illustration mascot-motion" />
      ) : (
        <>
          <span className="mascot-body" />
          <span className="mascot-head mascot-motion" />
        </>
      )}
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
        paused ? "Resume characters" : "Pause characters"
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
