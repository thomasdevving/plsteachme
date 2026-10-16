"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Pause, Play } from "lucide-react";
import { TieMotion } from "./tie-motion";
const tieSteps = [
  [
    "Start with the wide end longer.",
    "Keep the narrow end still as you practice.",
  ],
  ["Cross it over the narrow end.", "Bring the wide end across the front."],
  ["Wrap the wide end behind.", "Keep the fabric flat as it wraps behind."],
  ["Bring it across the front.", "Leave a little space in this front loop."],
  ["Lift it through the neck loop.", "Bring the wide end up from underneath."],
  [
    "Pass it through the front loop.",
    "Guide the tip down through the loose band.",
  ],
  [
    "Slide the knot up gently.",
    "A small, slightly angled knot. You’ve got it.",
  ],
];
export function CoachPreview() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const visible = useRef(false);
  // Autoplay starts only after checking the visitor's motion preference.
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPlaying(!preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const node = figure.current;
    if (!node) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      clearInterval(timer);
      if (playing && visible.current && !document.hidden)
        timer = setInterval(
          () => setStep((current) => (current + 1) % tieSteps.length),
          3000,
        );
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current =
          entry.isIntersecting && entry.intersectionRatio >= 0.35;
        sync();
      },
      { threshold: [0, 0.35] },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [playing]);
  return (
    <figure
      ref={figure}
      id="hero-preview"
      className="phone-figure interactive-phone"
      aria-label="Tie a tie: coaching example"
      data-playing={playing}
    >
      <div className="phone">
        <div className="phone-top">
          <span className="brand-mini">
            <span className="brand-teach">plsteach</span>
            <span className="brand-me">.me</span>
          </span>
          <span className="camera-dot" />
          <span>9:41</span>
        </div>
        <div className="viewfinder">
          <div className="camera-corner tl" />
          <div className="camera-corner tr" />
          <div className="camera-corner bl" />
          <div className="camera-corner br" />
          <div className="phone-module-art">
            <TieMotion step={step} playing={playing} />
          </div>
          <div className="coach-status">
            <span />
            Four-in-hand knot · front view
          </div>
        </div>
        <div className="phone-instruction">
          <div
            className="phone-progress"
            role="progressbar"
            aria-label="Example progress"
            aria-valuemin={1}
            aria-valuemax={tieSteps.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${tieSteps.length}`}
          >
            {tieSteps.map((_, i) => (
              <span key={i} className={i <= step ? "complete" : ""} />
            ))}
          </div>
          <div key={step} className="coach-step">
            <p>
              Step {step + 1} of {tieSteps.length}
            </p>
            <p className="phone-step-title">{tieSteps[step][0]}</p>
          </div>
        </div>
        <div className="phone-home" />
      </div>
      <div className="feedback" key={`feedback-${step}`}>
        <MessageCircle size={20} aria-hidden="true" />
        <span>{tieSteps[step][1]}</span>
      </div>
      <div className="preview-playback">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          title={
            playing
              ? "Pause the demonstration and characters"
              : "Play the demonstration and characters"
          }
          aria-label={
            playing ? "Pause tie demonstration" : "Play tie demonstration"
          }
        >
          {playing ? (
            <Pause size={14} aria-hidden="true" />
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
          {playing ? "Pause" : "Play"}
        </button>
      </div>
    </figure>
  );
}
