# Public test phase checklist

What protects the service once anyone can sign up, and what still has to be set outside the code.

## In the code

- **Free session is bounded.** One lesson, at most `TRIAL_MAX_AI_CALLS` AI checks (150) within `TRIAL_MAX_MINUTES` (120), counted in the database (`coaching_trial_use`). When either runs out the session ends for good.
- **One free session per email address**, also after deleting and recreating an account (`trial_claims` keeps a SHA-256 of the lowercased address).
- **Daily AI budget.** Every AI call (coaching, questions, lesson drafting, transcription, organization drafting and coaching) counts against `AI_DAILY_CALL_LIMIT` (`ai_budget_use`). Past it, AI features return a "paused for today" message. If the check itself fails, AI fails closed.
- **Rate limits** use the address Cloudflare sets (`cf-connecting-ip`), so they cannot be bypassed by a forged `X-Forwarded-For`. A full in-memory limiter evicts old entries instead of refusing everyone. Durable limits in the database (`rate_hit`) cover sign-in emails (8 per address per hour, 4 per email per hour) and daily limits for skill requests, teacher applications, lessons, drafting and transcription.
- **CAPTCHA** on sign-in and sign-up when `TURNSTILE_SITE_KEY` is set (Cloudflare Turnstile, verified by Supabase Auth).
- **Sign-up** requires confirming age 16+ and the terms of use (`/terms`).
- **Moderation:** reviewers (`PLATFORM_REVIEWER_IDS`) can hide community requests; hidden requests leave the public board.
- **Security headers** in production: CSP (no framing by other sites, scripts only same-origin plus Turnstile and the configured analytics host), HSTS, `X-Frame-Options: DENY`.
- **Errors:** friendly error pages (`error.tsx`, `global-error.tsx`); structured JSON error logs (`lib/log.ts`), with AI failures logged by category only (`ai.quota`, `ai.rate_limited`, `ai.timeout`, `ai.failed`, `ai.budget_exhausted`). Workers Logs are enabled in `wrangler.jsonc`.
- **Health:** `GET /api/health` returns 200 when the database answers and AI is configured.
- **Internal tools** (`/coach/eval`, `?debug=1`) are off unless `ENABLE_INTERNAL_TOOLS=true`.
- **Retention:** the daily GitHub workflow fails visibly when its secret is missing, and also clears expired rate-limit and AI-usage rows.

## To do outside the code

1. Run migrations `20261021090000_accounts_progress_insights.sql` and `20261022090000_public_launch_safeguards.sql`, then `npm run verify:setup` (it now checks every migration).
2. OpenAI: set a monthly budget and usage alerts on the project. This is the final backstop behind `AI_DAILY_CALL_LIMIT`.
3. Supabase Auth: custom SMTP (for example Resend SMTP), Site URL and redirect URLs for `https://plsteach.me/auth/callback` and `/auth/confirm`, and CAPTCHA protection with Turnstile (secret key). Add `TURNSTILE_SITE_KEY` to the Worker.
4. Worker variables: `MAINTENANCE_SECRET`, `COACHING_SESSION_SECRET`, `PLATFORM_REVIEWER_IDS`, `TRAINING_ACCESS_EMAILS`, `VISION_LAB_EMAILS`, `CONTACT_EMAIL`, and the limits above if you want other values. `NEXT_PUBLIC_SITE_URL` must be set in the build environment.
5. GitHub: repository secret `MAINTENANCE_SECRET` (same value).
6. Monitoring: point an uptime monitor at `/api/health`, and add a Cloudflare notification or Logpush filter on `ai.quota` and `ai.budget_exhausted`.
7. Legal: business name, address, registration number and contact on the privacy page (the draft banner stays until then); have the privacy statement and `/terms` reviewed.
