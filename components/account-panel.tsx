"use client";
import { fetchWithTimeout } from '@/lib/network';
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import type { Trial } from "@/lib/auth/trial";
import { trialResumeHref } from '@/lib/auth/trial-reference';
import { ProfileSettings } from './profile-settings';
export function AccountPanel() {
  const [account, setAccount] = useState<{
    user: { email?: string } | null;
    trial?: Trial;
    configured: boolean;
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
      setError("Your account could not load. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function signout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signout" }),
      });
      if (!response.ok) throw new Error();
      window.location.assign("/login");
    } catch {
      setError("Could not sign out. Please try again.");
      setBusy(false);
    }
  }
  const trial = account?.trial;
  return (
    <div className="auth-form-area account-panel">
      <h1>Your next little step.</h1>
      {error ? (
        <>
          <p role="alert" className="auth-error">
            {error}
          </p>
          <button className="button secondary" onClick={load}>
            Try again
          </button>
        </>
      ) : !account ? (
        <p role="status" className="auth-intro">
          Loading your account…
        </p>
      ) : !account.user ? (
        <>
          <p className="auth-intro">
            Sign in to find your free coaching session.
          </p>
          <a className="button primary" href="/login">
            Log in
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </>
      ) : (
        <>
          <p className="auth-intro account-email">{account.user.email}</p>
          <ProfileSettings />
          <section className="account-trial">
            <h2>
              {trial?.completed_at
                ? "Your free session is complete."
                : trial
                  ? "Your session is waiting."
                  : "One free session, just for you."}
            </h2>
            <p>
              {trial?.completed_at
                ? "You’ve taken the first step. More coaching is coming soon."
                : trial
                  ? "Pick up your chosen skill where you left off. It’s the same free session."
                  : "Choose a skill and work through it with your coach, from start to finish. No card needed."}
            </p>
            <a
              className="button primary"
              href={
                trial?.completed_at
                  ? "/subscriptions"
                  : trial
                    ? trialResumeHref(trial.skill_id)
                    : "/learn"
              }
            >
              {trial?.completed_at
                ? "Explore plans"
                : trial
                  ? "Resume session"
                  : "Choose a skill"}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            {trial?.completed_at && (
              <small>All plan prices are coming soon.</small>
            )}
          </section>
          <button
            className="auth-text-button"
            disabled={busy}
            onClick={signout}
          >
            <LogOut size={17} aria-hidden="true" />
            {busy ? "Signing out…" : "Sign out"}
          </button>
          <DeleteAccount />
        </>
      )}
    </div>
  );
}

/** Self-service deletion: account, progress, requests, teacher lessons and their videos. */
function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", confirm: confirm.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Your account could not be deleted. Please try again.");
      window.location.assign("/?account=deleted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your account could not be deleted. Please try again.");
      setBusy(false);
    }
  }
  return (
    <details className="account-delete" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Delete my account</summary>
      <p>
        This permanently deletes your account, your profile and photo, your saved lesson progress, your free session, your skill requests and
        support, and any teacher profile, lessons and demonstration videos. Organizations you belong to keep their own
        training records without your name or email. This cannot be undone.
      </p>
      <label>
        Type <strong>delete my account</strong> to confirm
        <input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
      </label>
      <button className="button secondary" type="button" disabled={busy || confirm.trim().toLowerCase() !== "delete my account"} onClick={remove}>
        {busy ? "Deleting…" : "Permanently delete my account"}
      </button>
      {error && <p role="alert" className="auth-error">{error}</p>}
    </details>
  );
}
