"use client";
import { fetchWithTimeout } from "@/lib/network";
import { passwordError } from "@/lib/auth/password";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { PasswordField } from "./password-field";
export function AuthForm({
  signup = false,
  enabled,
  next = "/account",
  invalidLink = false,
}: {
  signup?: boolean;
  enabled: boolean;
  next?: string;
  invalidLink?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [error, setError] = useState(
    invalidLink
      ? "This email link has expired or has already been used. Log in, or enter your email and request a new confirmation."
      : "",
  );
  const [cooldown, setCooldown] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sent) heading.current?.focus();
  }, [sent]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(action: "signup" | "login" | "resend-confirmation") {
    if (
      busy ||
      !enabled ||
      !ready ||
      (action === "resend-confirmation" && cooldown)
    )
      return;
    if (action === "signup") {
      const invalid = passwordError(password);
      if (invalid) {
        setError(invalid);
        return;
      }
      if (password !== confirmation) {
        setError("Your passwords do not match.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "resend-confirmation"
            ? { action, email }
            : { action, email, password, next },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        setUnconfirmed(result.code === "email_not_confirmed");
        if (response.status === 429) setCooldown(60);
        throw new Error(result.error || "Could not sign in. Please try again.");
      }
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setPassword("");
      setConfirmation("");
      setSent(true);
      setCooldown(60);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Connection lost. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-form-area">
      {sent ? (
        <>
          <Mail className="auth-mail-icon" size={32} aria-hidden="true" />
          <h1 ref={heading} tabIndex={-1}>
            Check your inbox.
          </h1>
          <p className="auth-intro">
            If <strong>{email}</strong> needs confirmation, you’ll receive a
            link to verify your email. After that, log in with your password.
          </p>
          <p className="auth-hint">
            Check spam if it hasn’t arrived. Already confirmed your account?{" "}
            <a href="/login">Log in</a> or{" "}
            <a href="/forgot-password">reset your password</a>.
          </p>
          <button
            className="button primary auth-submit"
            disabled={!ready || busy || cooldown > 0}
            onClick={() => void submit("resend-confirmation")}
          >
            {busy
              ? "Sending…"
              : cooldown
                ? `Resend in ${cooldown}s`
                : "Resend confirmation"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button
            className="auth-text-button"
            onClick={() => {
              setSent(false);
              setUnconfirmed(false);
              setError("");
            }}
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <h1>{signup ? "Create your account." : "Welcome back."}</h1>
          <p className="auth-intro">
            {signup
              ? "Your first coaching session is free. No card needed."
              : "Log in and pick up where you left off."}
          </p>
          <form
            method="post"
            action="/api/auth/action"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(signup ? "signup" : "login");
            }}
          >
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setUnconfirmed(false);
              }}
              required
              maxLength={254}
              disabled={!enabled || !ready || busy}
            />
            <PasswordField
              value={password}
              onChange={setPassword}
              current={!signup}
              disabled={!enabled || !ready || busy}
            />
            {signup && (
              <PasswordField
                value={confirmation}
                onChange={setConfirmation}
                confirm
                disabled={!enabled || !ready || busy}
              />
            )}
            {!signup && (
              <p className="auth-hint">
                <a href="/forgot-password">Forgot your password?</a>
              </p>
            )}
            <button
              className="button primary auth-submit"
              type="submit"
              disabled={!enabled || !ready || busy}
            >
              {busy
                ? signup
                  ? "Creating account…"
                  : "Logging in…"
                : signup
                  ? "Create account"
                  : "Log in"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          {(unconfirmed || invalidLink) && (
            <button
              className="auth-text-button"
              disabled={
                !enabled || !ready || busy || !email.trim() || cooldown > 0
              }
              onClick={() => void submit("resend-confirmation")}
            >
              {cooldown
                ? `Resend in ${cooldown}s`
                : "Resend confirmation email"}
            </button>
          )}
          {!signup && (
            <p className="auth-hint">
              Used an email sign-in link before?{" "}
              <a href="/forgot-password">Set your password</a> to continue with
              the same account.
            </p>
          )}
        </>
      )}
      {error && (
        <p id="auth-error" className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!enabled && (
        <p className="auth-unavailable" role="status">
          Sign-in is temporarily unavailable.{" "}
          <a href="/learn">Explore the lessons</a> and try again later. Your
          free session has not been used.
        </p>
      )}
      <p className="auth-switch">
        {signup ? "Already have an account?" : "New to plsteach.me?"}{" "}
        <a
          href={`${signup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}
        >
          {signup ? "Log in" : "Create an account"}
        </a>
      </p>
      {signup && (
        <p className="auth-privacy">
          Accounts are for people aged 16 and over. By creating an account, you
          agree to our <a href="/terms">Terms of use</a>. Read{" "}
          <a href="/privacy">how we handle your data</a>.
        </p>
      )}
    </div>
  );
}
