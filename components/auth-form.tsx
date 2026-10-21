"use client";
import { fetchWithTimeout } from '@/lib/network';
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mail, LoaderCircle } from "lucide-react";
export function AuthForm({
  signup = false,
  enabled,
  google,
  apple,
  next = "/account",
  invalidLink = false,
  captchaSiteKey = "",
}: {
  signup?: boolean;
  enabled: boolean;
  google: boolean;
  apple: boolean;
  next?: string;
  invalidLink?: boolean;
  captchaSiteKey?: string;
}) {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const captcha = useTurnstile(captchaSiteKey);
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    invalidLink
      ? "This sign-in link has expired or was opened in another browser. Request a new link below."
      : "",
  );
  const [cooldown, setCooldown] = useState(0);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sent) sentHeading.current?.focus();
  }, [sent]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(action: "email" | "google" | "apple") {
    if (busy || !enabled) return;
    if (signup && !agreed) {
      setError("Please confirm you are 16 or older and agree to the terms of use.");
      return;
    }
    if (action === "email" && captchaSiteKey && !captcha.token) {
      setError("Please complete the security check above the button.");
      return;
    }
    setBusy(action);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "email"
            ? { action, email, signup, next, captchaToken: captcha.token || undefined }
            : { action: "oauth", provider: action, next },
        ),
      });
      // An error page from the host is not JSON; show a readable message instead of a parser error.
      const result = await response.json().catch(() => null);
      if (!response.ok || !result)
        throw new Error(result?.error || "Sign-in is temporarily unavailable. Please try again in a moment.");
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setSent(true);
      setCooldown(60);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Connection lost. Please try again.",
      );
    } finally {
      setBusy("");
      // A security-check token works once; get a fresh one for a resend.
      if (action === "email") captcha.reset();
    }
  }
  return (
    <div className="auth-form-area">
      {sent ? (
        <>
          <Mail className="auth-mail-icon" size={32} aria-hidden="true" />
          <h1 ref={sentHeading} tabIndex={-1}>
            Check your inbox.
          </h1>
          <p className="auth-intro">
            {signup
              ? "Your sign-up link is on its way to "
              : "If you have an account, your sign-in link is on its way to "}
            <strong>{email}</strong>.
          </p>
          <p className="auth-hint">
            Open the link in this browser to continue. Check your spam folder if
            it hasn’t arrived.
          </p>
          <button
            className="button primary auth-submit"
            disabled={!!busy || cooldown > 0}
            onClick={() => submit("email")}
          >
            {busy
              ? "Sending…"
              : cooldown
                ? `Resend in ${cooldown}s`
                : "Resend email"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button
            className="auth-text-button"
            onClick={() => {
              setSent(false);
              setError("");
            }}
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <h1>{signup ? "A little help starts here." : "Welcome back."}</h1>
          <p className="auth-intro">
            {signup
              ? "Create your account. Your first coaching session is free."
              : "Sign in and pick up where you left off."}
          </p>
          {signup && (
            <label className="auth-consent">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                I am 16 or older and agree to the{" "}
                <a href="/terms" target="_blank">terms of use</a> and the{" "}
                <a href="/privacy" target="_blank">privacy statement</a>.
              </span>
            </label>
          )}
          <div className="auth-providers">
            <button
              className="auth-provider"
              disabled={!enabled || !google || !!busy}
              onClick={() => submit("google")}
            >
              <GoogleMark />
              <span>
                {busy === "google" ? "Connecting…" : "Continue with Google"}
              </span>
              {busy === "google" && (
                <LoaderCircle
                  size={18}
                  className="auth-spinner"
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              className="auth-provider"
              disabled={!enabled || !apple || !!busy}
              onClick={() => submit("apple")}
            >
              <AppleMark />
              <span>
                {busy === "apple" ? "Connecting…" : "Continue with Apple"}
              </span>
              {busy === "apple" && (
                <LoaderCircle
                  size={18}
                  className="auth-spinner"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
          {enabled && (!google || !apple) && (
            <p className="auth-hint">
              {!google && !apple
                ? "Google and Apple sign-in are coming soon."
                : `${!google ? "Google" : "Apple"} sign-in is coming soon.`}{" "}
              You can continue with email.
            </p>
          )}
          <div className="auth-divider">
            <span>or use your email</span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit("email");
            }}
          >
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              disabled={!enabled || !!busy}
              aria-describedby={error ? "auth-error" : undefined}
            />
            {captchaSiteKey && <div className="auth-captcha" ref={captcha.ref} />}
            <button
              className="button primary auth-submit"
              type="submit"
              disabled={!enabled || !!busy}
            >
              {busy === "email"
                ? "Sending your link…"
                : signup
                  ? "Create account with email"
                  : "Email me a sign-in link"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="auth-hint">
            A secure link in your inbox. No password to remember.
          </p>
        </>
      )}
      {error && (
        <p id="auth-error" className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!enabled && (
        <p className="auth-unavailable" role="status">
          Sign-in is temporarily unavailable. <a href="/learn">Explore the lessons</a>{" "}
          and try again later. Your free session has not been used.
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
      <p className="auth-privacy">
        Your privacy matters. Read{" "}
        <a href="/privacy">how we handle your data</a>.
      </p>
    </div>
  );
}
type TurnstileApi = { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void };
/** Cloudflare Turnstile security check, loaded only when a site key is configured. */
function useTurnstile(siteKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  useEffect(() => {
    const element = ref.current;
    if (!siteKey || !element) return;
    let cancelled = false;
    const win = window as unknown as { turnstile?: TurnstileApi };
    const mount = () => {
      if (cancelled || !win.turnstile || widget.current) return;
      widget.current = win.turnstile.render(element, { sitekey: siteKey, appearance: "interaction-only", callback: (value: string) => setToken(value), "expired-callback": () => setToken(""), "error-callback": () => setToken("") });
    };
    if (win.turnstile) mount();
    else {
      const id = "cf-turnstile-script";
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
      if (widget.current && win.turnstile) win.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);
  const reset = () => {
    const win = window as unknown as { turnstile?: TurnstileApi };
    setToken("");
    if (widget.current && win.turnstile) win.turnstile.reset(widget.current);
  };
  return { ref, token, reset };
}
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.59 9.59 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.4 1.5c.1 1.2-.3 2.4-1 3.2-.8.9-1.9 1.5-3.1 1.4-.2-1.2.4-2.4 1.1-3.2.8-.9 2-1.4 3-1.4ZM20.1 17.4c-.5 1.1-.7 1.6-1.4 2.5-.9 1.3-2.2 2.9-3.8 2.9-1.4 0-1.8-.9-3.7-.9s-2.4.9-3.8.9c-1.6.1-2.8-1.4-3.7-2.7-2.5-3.5-2.8-8.2-1.3-10.7 1.1-1.8 2.8-2.9 4.5-2.9 1.7 0 2.7 1 4.1 1 1.3 0 2.1-1 4.1-1 1.5 0 3 .9 4 2.2-3.5 1.9-3 6.9 1 8.7Z" />
    </svg>
  );
}
