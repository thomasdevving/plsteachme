# Current deployment

The production site is https://plsteach.me, with www attached to the same Cloudflare Worker. Workers Free, Supabase Free and Resend Free were selected explicitly. Do not upgrade a plan or enable paid overages automatically. OpenAI is separate and will be configured by the operator.

## Services

- Cloudflare Worker `plsteachme`: Next.js through OpenNext; static assets use its asset binding. No R2, Images or analytics service is required. Runtime credentials are encrypted Worker secrets.
- Supabase project `gftceofvypaviluwercw` in the `pft` organisation, Frankfurt: Auth, 14 protected tables, private teacher recordings and camera-image preprocessing.
- Resend: verified `plsteach.me` domain, Ireland region, TLS enforced; sending-only domain-restricted key stored in Supabase SMTP. No key is shipped to the website. The free allowance is 100 emails/day and 3,000/month; Supabase also has its own email rate limit.
- Cloudflare Email Routing: `contact@plsteach.me` forwards to the operator's verified private mailbox. This is forwarding, not a mailbox for sending arbitrary replies. Keep the destination private.
- Supabase Email Auth: registrations and email confirmation enabled; Site URL `https://plsteach.me`; redirect allowlist `https://plsteach.me/auth/**`. Email/password is the only offered sign-in method; social providers remain disabled.
- SMTP: `smtp.resend.com`, port 465, username `resend`, sender `contact@plsteach.me`, display name `plsteach.me`. The password is the restricted Resend key. Signup confirmation uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}`. Password recovery adds `&amp;type=recovery`; its source is saved in `supabase/templates/recovery.html`. Passwords require at least 12 characters and secure password changes are enabled.

## Build and deploy

Use Node 24 and `npm ci`. Local secrets belong in ignored `.dev.vars`; normal development and the setup checker load it. Never commit that file, copy it into `.env*`, or print it. OpenNext copies `.env*` files into the server bundle, so the Cloudflare build rejects secret-like values in those files. Public site/operator values come from `wrangler.jsonc` at build and request time.

```sh
npm run build:cloudflare
npx opennextjs-cloudflare deploy
```

Wrangler authentication is already configured on the operator's machine. No paid plan is required by this configuration. `SUPABASE_SERVICE_ROLE_KEY` is already a Worker secret. Add `OPENAI_API_KEY` through the Cloudflare Worker Settings > Variables and Secrets panel as a **Secret**, or interactively with `npx wrangler secret put OPENAI_API_KEY`. Never paste credentials into chat or public variables. A secret update creates a new Worker version; verify that it is deployed.

`OPENAI_VISION_MODEL` defaults to `gpt-6-luna` and `OPENAI_TRANSCRIPTION_MODEL` to `gpt-4o-transcribe`. Verify access and paid inference separately after adding the key. Keep provider budget controls appropriate for testing. Accounts use email and password only. Google/Apple remain disabled. Email verification, confirmation resend and password recovery use Supabase with the existing Resend SMTP configuration. See [account setup](../AUTH_SETUP.md).

The public header checks the server session rather than displaying a fixed Log in button. It rechecks on browser history restoration and focus, retaining the last confirmed state on a temporary network failure. Auth cookies remain HttpOnly, secure in production and scoped to `/`. Login/signup redirect an already authenticated user to their safe app destination. Verify the complete home/account/renewal/sign-out flow with `node --env-file=.dev.vars scripts/verify-auth-navigation.mjs https://plsteach.me`; it removes its disposable fixture and sends no email or AI request.

## Camera processing on the free plan

Workers Free has a small CPU allowance. JPEG decoding is therefore delegated to `clean-camera-frame` in the existing Supabase project. The Worker uses `CAMERA_PROCESSOR=supabase`, sends its server credential only to the configured HTTPS Supabase origin, and requests Frankfurt execution. The function authenticates with `withSupabase({ auth: 'secret:*' })`; `verify_jwt=false` is intentional for modern secret keys and does **not** make it public. Missing, public and forged credentials are rejected.

The function bounds the request, pixels and decoder memory, applies EXIF orientation, resizes to 640px, removes metadata, and returns JPEG bytes without persisting images or logging payloads. `lib/camera-frame.ts` is shared by the function and local fallback. Deploy changes to it together with the function, not only the Worker:

```sh
supabase functions deploy clean-camera-frame --project-ref gftceofvypaviluwercw
```

The `supabase/config.toml` and function import map are committed. Real AI latency, free-plan resource usage and teacher transcription still need an acceptance run with OpenAI enabled.

## Database history

All four application migrations are already applied. Do not run their SQL again on production. They were applied through the Supabase connector under these remote versions:

| Repository version | Remote version | Name |
| --- | --- | --- |
| 202610130001 | 20261017205818 | waitlist |
| 202610130002 | 20261017205821 | more_modules |
| 202610170001 | 20261017205823 | accounts_and_trials |
| 20261017172015 | 20261017205827 | teacher_platform |

Reconcile migration history against this mapping before a future CLI `db push`; do not reset the database or reapply existing tables. All public tables use RLS; privileged writes happen through validated server endpoints. The trial is account-bound, atomic and resumable.

## Checks and remaining setup

```sh
npm test
npm run typecheck
npm run verify:setup -- --url https://plsteach.me
node --env-file=.dev.vars scripts/verify-connected-account.mjs https://plsteach.me
```

The last check is intentionally for the pre-OpenAI setup: it creates two disposable example.com accounts, checks secure login, trial isolation and completion, and removes its fixtures. It sends no email and makes no AI requests. Do not run write-capable mock browser suites against production.

The operator completed a real signup, inbox delivery, email confirmation and sign-in check on 18 October 2026; the free session remains unused. Add a confirmed, independent reviewer's Supabase user ID to `PLATFORM_REVIEWER_IDS` before exercising teacher approval/publication. A teacher cannot approve their own contribution. Missing OpenAI does not consume a learner's free session.

Privacy and terms describe the actual providers, necessary storage, optional AI and human content reporting. No analytics/cookie banner was added. Operational deletion/report handling, applicable provider agreements and any business registration/address disclosures remain the operator's responsibility; the code and notices do not constitute legal certification. Subscription presentation is unchanged and there is no paid checkout.
