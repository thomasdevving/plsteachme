"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { fetchWithTimeout } from "@/lib/network";
import { passwordError } from "@/lib/auth/password";
import { PasswordField } from "./password-field";
export function PasswordForm({
  update = false,
  enabled,
  invalidLink = false,
}: {
  update?: boolean;
  enabled: boolean;
  invalidLink?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(
    invalidLink
      ? "This reset link has expired or has already been used. Request a new one below."
      : "",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (done) heading.current?.focus();
  }, [done]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit() {
    if (busy || !enabled || !ready || cooldown) return;
    if (update) {
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
          update
            ? { action: "update-password", password }
            : { action: "reset-password", email },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429) setCooldown(60);
        throw new Error(
          result.error || "Could not complete this request. Please try again.",
        );
      }
      setDone(true);
      setPassword("");
      setConfirmation("");
      if (!update) setCooldown(60);
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
      <h1 ref={heading} tabIndex={-1}>
        {done
          ? update
            ? "Password saved."
            : "Check your inbox."
          : update
            ? "Set your password."
            : "Forgot your password?"}
      </h1>
      <p className="auth-intro">
        {done
          ? update
            ? "Use your email and this password next time you log in. Your account and free session stay the same."
            : "If this email belongs to an account, we’ve sent a link to set a new password. Check your spam folder too."
          : update
            ? "Choose a password for your existing account."
            : "Enter your account email. We’ll send a link to reset your password, or set one for the first time."}
      </p>
      {done && update ? (
        <a href="/account" className="button primary">
          Back to your account
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      ) : (
        <form
          method="post"
          action="/api/auth/action"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {update ? (
            <>
              <PasswordField
                value={password}
                onChange={setPassword}
                disabled={!enabled || !ready || busy}
              />
              <PasswordField
                value={confirmation}
                onChange={setConfirmation}
                confirm
                disabled={!enabled || !ready || busy}
              />
            </>
          ) : (
            <>
              <label htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!enabled || !ready || busy}
              />
            </>
          )}
          <button
            type="submit"
            className="button primary auth-submit"
            disabled={!enabled || !ready || busy || cooldown > 0}
          >
            {busy
              ? "Please wait…"
              : cooldown
                ? `Try again in ${cooldown}s`
                : update
                  ? "Save password"
                  : done
                    ? "Resend reset link"
                    : "Send reset link"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!enabled && (
        <p className="auth-unavailable" role="status">
          Account services are temporarily unavailable. Please try again later.
        </p>
      )}
      <p className="auth-switch">
        <a href={update ? "/forgot-password" : "/login"}>
          {update ? "Request a new reset link" : "Back to log in"}
        </a>
      </p>
    </div>
  );
}
