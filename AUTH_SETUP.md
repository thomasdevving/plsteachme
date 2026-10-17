# Accounts and the one-session trial

The deployed app uses **email and password only**, Supabase Auth, Resend SMTP and Cloudflare Workers Free. Social providers remain disabled. Existing subscriptions are unchanged.

## Configuration

The existing Supabase project has all four migrations applied. Do not reapply migrations to an already-configured project. See [deployment setup](docs/CLOUDFLARE_SETUP.md) for environment variables. Store local secrets in ignored `.dev.vars` and deployed secrets in Cloudflare Worker secrets; OpenNext copies `.env` files into its bundle.

In Supabase Auth:

- Enable the Email provider, new registrations and email confirmation.
- Minimum password length: **12**. Enable **Secure password change**, requiring a session created within the last 24 hours. An older session must use a fresh password reset link.
- Keep anonymous sign-in and social providers disabled.
- Site URL: `https://plsteach.me`; redirect allowlist: `https://plsteach.me/auth/**`.
- Keep the configured Resend SMTP sender `contact@plsteach.me`. No paid plan is needed for this setup.
- Confirm-signup template link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}`.
- Reset-password template link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery`.

Both templates open the app directly and exchange the one-use token hash server-side. Recovery opens `/account/password`; normal verification opens `/account`. The PKCE callback remains compatible with standard Supabase templates. Tokens and provider error details are never returned by the account action API or logged by the verification scripts.

## User flows

- `/signup`: email, password and confirmation; sends an email verification link. Registration does not consume the free session.
- `/login`: email and password. Unknown accounts and incorrect passwords share a generic error. Unconfirmed accounts can request another confirmation email.
- `/forgot-password`: sends a reset link with an account-existence-neutral response.
- `/account/password`: signed-in users can set or change their password, including existing accounts created with an email link. The API verifies the current user; client-supplied account IDs are ignored. Expired recovery links return to the reset form.
- Returning home, reloading or changing pages preserves the account. Explicit sign-out ends it.

New passwords require at least 12 characters and at most 72 UTF-8 bytes to avoid bcrypt truncation. Passwords are sent over HTTPS to the server and Supabase Auth; they are not stored in application tables, browser storage or logs. Supabase stores password hashes. Forms stay disabled until hydration completes, so early typing cannot be lost; their fallback method is POST so passwords cannot become URL parameters. Error responses are bounded and omit internal provider messages. All account mutations require a same-origin request, and responses are private and uncached.

## Free-session behavior

Each account has one full coaching session. It is claimed only when the user explicitly starts coaching for an available skill. Concurrent starts return the same durable session. Changing passwords, recovering the account, signing out or clearing browser storage does not grant another session. Missing OpenAI configuration does not consume it. The subscription page has no checkout or automatic charge.

Account identity is verified with Supabase `getUser()`. AI endpoints check account ownership, session ID, skill and completion. RLS and service-role-only transactional functions protect the trial ledger. This is a rule per account; it does not claim to prevent a person creating separate accounts.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build:cloudflare`.

With connected credentials in `.dev.vars`, run:

```sh
node --env-file=.dev.vars scripts/verify-password-auth.mjs https://plsteach.me
node --env-file=.dev.vars scripts/verify-auth-navigation.mjs https://plsteach.me
```

The `--smtp-recovery` option sends only the recovery email when signup delivery has already been verified.

The password check creates disposable accounts, exercises real password authentication, verification/recovery tokens, password changes and unchanged free-session entitlement, then deletes its fixtures. It never accesses personal accounts or calls OpenAI. Its default mode generates test tokens without sending mail; `--smtp` additionally exercises signup and recovery delivery using Resend's documented `delivered+label@resend.dev` test inbox. Provider delivery simulation does not prove inbox placement for a real recipient. Keep tracing off because token URLs and cookies are credentials.

Official references: [password authentication](https://supabase.com/docs/guides/auth/passwords), [password security](https://supabase.com/docs/guides/auth/password-security), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Resend test emails](https://resend.com/docs/dashboard/emails/send-test-emails).
