"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { VIDEO_URL } from "@/lib/config";
import { track } from "@/lib/analytics";
import { TieMotion } from "./tie-motion";
import { useMotionPaused, setMotionPaused } from "@/lib/motion-preference";

const captions = [
  "Start with the wide end longer.",
  "Cross it over the narrow end.",
  "Wrap the wide end behind.",
  "Bring it across the front.",
  "Lift it through the neck loop.",
  "Pass it through the front loop.",
  "Slide the knot up gently.",
];

export function DemoPlayer({
  active = true,
  src = VIDEO_URL,
}: {
  active?: boolean;
  src?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const motionPaused = useMotionPaused();

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active || motionPaused) {
      video.current?.pause();
      setPlaying(false);
    }
  }, [active, motionPaused]);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const stop = () => {
      video.current?.pause();
      setPlaying(false);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) stop();
    });
    observer.observe(node);
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!active || !playing || src || motionPaused) return;
    const timer = setInterval(() => {
      setStep((current) => Math.min(current + 1, captions.length - 1));
    }, 3000);
    return () => clearInterval(timer);
  }, [active, playing, src, motionPaused]);

  useEffect(() => {
    if (step === captions.length - 1) setPlaying(false);
  }, [step]);

  async function toggle() {
    if (!active) return;
    if (motionPaused) setMotionPaused(false);
    if (playing) {
      video.current?.pause();
      setPlaying(false);
      return;
    }
    setError(false);
    if (step === captions.length - 1) setStep(0);
    setStarted(true);
    if (src && video.current) {
      try {
        await video.current.play();
      } catch {
        setError(true);
        return;
      }
    }
    setPlaying(true);
    track(src ? "demo_video_play" : "demo_preview_play");
  }

  const ended = !src && step === captions.length - 1;
  return (
    <div ref={root} className="demo-player" data-started={started}>
      {src ? (
        <video
          ref={video}
          src={src}
          controls={started}
          playsInline
          preload="none"
          poster="/tie.svg"
          aria-label="Demonstration: tying a tie"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError(true)}
        />
      ) : (
        <div className="demo-placeholder">
          <div className="demo-placeholder-art">
            <TieMotion
              step={step}
              playing={playing && active && !reducedMotion}
            />
          </div>
          <div className="demo-placeholder-copy">
            <span className="demo-placeholder-label">Demo preview</span>
            <p>{started ? captions[step] : "One tie. Seven little steps."}</p>
            <small>
              {started
                ? `Step ${step + 1} of 7 · Placeholder`
                : "Demo video coming soon"}
            </small>
          </div>
        </div>
      )}
      {(!src || !playing || error) && (
        <button
          type="button"
          className="demo-player-toggle"
          onClick={toggle}
          disabled={!active}
          aria-label={
            playing
              ? "Pause demo preview"
              : ended
                ? "Replay demo preview"
                : src
                  ? "Play demo video"
                  : "Play demo preview"
          }
        >
          {playing ? (
            <Pause size={20} aria-hidden="true" />
          ) : ended ? (
            <RotateCcw size={20} aria-hidden="true" />
          ) : (
            <Play size={20} aria-hidden="true" />
          )}
          <span>{playing ? "Pause" : ended ? "Replay" : "Play"}</span>
        </button>
      )}
      {error && (
        <p className="demo-player-error" role="status">
          The video could not load. Please try Play again.
        </p>
      )}
    </div>
  );
}
