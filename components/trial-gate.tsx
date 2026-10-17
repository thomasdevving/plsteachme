"use client";
import { fetchWithTimeout } from '@/lib/network';
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AvailableSkill } from "@/lib/skills/schema";
import type { Trial } from "@/lib/auth/trial";
import { trialResumeHref } from '@/lib/auth/trial-reference';
import { createSession } from "@/lib/session/machine";
import { readLocal, writeLocal } from "@/lib/storage/store";
import { SessionCoach } from "./session-coach";
export function TrialGate({
  skill,
  graphics,
  debug,
}: {
  skill: AvailableSkill;
  graphics: Record<string, string>;
  debug: boolean;
}) {
  const [account, setAccount] = useState<{
    user: unknown;
    configured: boolean;
    trial?: Trial;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/session", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccount(data);
    } catch {
      setError("We couldn’t load your free session. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", skillId: skill.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.trial)
          setAccount((current) => current && { ...current, trial: data.trial });
        throw new Error(data.error);
      }
      // Carry the recent intake into this account's new session draft.
      try {
        const key = `plsteach.me:intake:${skill.id}`;
        const pending = JSON.parse(sessionStorage.getItem(key) || "null");
        if (
          pending &&
          Date.now() - pending.at < 30 * 60 * 1000 &&
          !(await readLocal(`trial:${data.trial.id}`))
        ) {
          const answers: Record<string, string> = {};
          for (const question of skill.intake) {
            const answer = pending.answers?.[question.id];
            if (question.options.includes(answer))
              answers[question.id] = answer;
          }
          await writeLocal(`trial:${data.trial.id}`, createSession(answers));
        }
        sessionStorage.removeItem(key);
      } catch {
        /* The session can still start with default guidance. */
      }
      setAccount((current) => current && { ...current, trial: data.trial });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start your session. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const trial = account?.trial;
  if (
    account?.user &&
    trial &&
    !trial.completed_at &&
    trial.skill_id === skill.id
  )
    return (
      <SessionCoach
        skill={skill}
        graphics={graphics}
        debug={debug}
        trial={{ id: trial.id, completedSteps: trial.completed_steps }}
      />
    );
  const next = encodeURIComponent(`/coach/session/${skill.id}`);
  return (
    <main className="page-width utility-page trial-gate">
      {!account ? (
        <>
          <h1>Your free coaching session.</h1>
          <p role="status">{error ? "" : "Checking your account…"}</p>
        </>
      ) : !account.user ? (
        <>
          <h1>A little help starts here.</h1>
          <p className="lead">
            Create an account for one free coaching session, from start to
            finish. No card needed.
          </p>
          <div className="session-buttons">
            <Link className="button primary" href={`/signup?next=${next}`}>
              Create an account
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="button secondary" href={`/login?next=${next}`}>
              Log in
            </Link>
          </div>
          {!account.configured && (
            <p className="small-note">
              Sign-in is temporarily unavailable.{" "}
              <a href="/learn">Explore the lessons</a> and try again later.
            </p>
          )}
        </>
      ) : trial?.completed_at ? (
        <>
          <h1>You’ve used your free session.</h1>
          <p className="lead">
            More coaching is coming soon. Your account includes one free
            session.
          </p>
          <Link className="button primary" href="/subscriptions">
            Explore plans
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </>
      ) : trial ? (
        <>
          <h1>Your session is waiting.</h1>
          <p className="lead">
            You’ve already chosen a skill for your free session. Continue where
            you left off.
          </p>
          <Link
            className="button primary"
            href={trialResumeHref(trial.skill_id)}
          >
            Resume your session
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <>
          <h1>Let’s {skill.title.toLowerCase()}.</h1>
          <p className="lead">
            Use your one free coaching session for this skill. You can take a
            break and resume it until you finish.
          </p>
          <button className="button primary" disabled={busy} onClick={start}>
            {busy ? "Starting…" : "Start my free session"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="small-note">
            One session per account. No payment details needed.
          </p>
        </>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!account && (
            <button className="button secondary" onClick={load}>
              Try again
            </button>
          )}
        </div>
      )}
    </main>
  );
}
