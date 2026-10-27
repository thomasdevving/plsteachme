"use client";
import { useEffect, useRef, useState } from "react";
import { fetchWithTimeout } from "@/lib/network";
import { useTurnstile } from "./auth-form";

export function PasswordForm({
  reset = false,
  enabled,
  captchaSiteKey = "",
}: {
  reset?: boolean;
  enabled: boolean;
  captchaSiteKey?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  const captcha = useTurnstile(enabled && !reset ? captchaSiteKey : "");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sent) heading.current?.focus();
  }, [sent]);
  async function submit() {
    if (busy || !enabled || !ready) return;
    if (reset && password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (!reset && captchaSiteKey && !captcha.token) {
      setError("Please complete the security check.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reset
            ? { action: "password", password }
            : {
                action: "recover",
                email,
                captchaToken: captcha.token || undefined,
              },
        ),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result)
        throw new Error(result?.error || "Please try again shortly.");
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
      captcha.reset();
    }
  }
  return (
    <div className="auth-form-area">
      <h1 ref={heading} tabIndex={-1}>
        {sent
          ? "Check your inbox."
          : reset
            ? "Choose your password."
            : "Forgot your password?"}
      </h1>
      <p className="auth-intro">
        {sent
          ? "If an account exists for this email address, a password reset link is on its way. Open it in this browser. Check your spam folder too."
          : reset
            ? "Choose a password with at least 12 characters. Your saved progress and free session will stay with your account."
            : "Enter your account email. We’ll send a link so you can set a new password. This also works if you previously signed in with an email link."}
      </p>
      {!sent && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {reset ? (
            <>
              <label htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!enabled || !ready || busy}
              />
              <label htmlFor="reset-confirm">Confirm new password</label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!enabled || !ready || busy}
              />
            </>
          ) : (
            <>
              <label htmlFor="recovery-email">Email address</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!enabled || !ready || busy}
              />
              {captchaSiteKey && (
                <div className="auth-captcha" ref={captcha.ref} />
              )}
            </>
          )}
          <button
            className="button primary auth-submit"
            disabled={!enabled || !ready || busy}
          >
            {busy
              ? "Please wait…"
              : reset
                ? "Save password"
                : "Send password reset link"}
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
      {reset && (
        <p className="auth-hint">
          An expired link?{" "}
          <a href="/forgot-password">Request a fresh reset link</a>.
        </p>
      )}
      <p className="auth-switch">
        <a href="/login">Back to log in</a>
      </p>
    </div>
  );
}
