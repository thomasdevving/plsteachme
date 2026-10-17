import type { ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { BrandMark } from "./brand";
import { Mascot, MascotMotionControl } from "./mascot";
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="auth-header container">
        <a href="/" className="wordmark" aria-label="plsteach.me home">
          <BrandMark />
        </a>
        <a className="text-link" href="/">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to home
        </a>
      </header>
      <main id="main" className="auth-layout container">
        <aside className="auth-welcome" aria-label="Your first session">
          <h2>
            A small step.
            <br />
            <span>A little more confidence.</span>
          </h2>
          <p>
            A tie. A shirt. A loose button.
            <br />
            Start with something you’d like to learn.
          </p>
          <div className="auth-companions" aria-hidden="true">
            <Mascot pose="sitting" color="orange" />
            <Mascot pose="cross-legged" />
          </div>
          <div className="auth-motion-control">
            <MascotMotionControl />
          </div>
          <div className="auth-trial-note">
            <Check size={19} aria-hidden="true" />
            <div>
              <strong>One free coaching session.</strong>
              <p>
                One skill, from start to finish.
                <br />
                Included with every account. No card needed.
              </p>
            </div>
          </div>
        </aside>
        {children}
      </main>
    </>
  );
}
