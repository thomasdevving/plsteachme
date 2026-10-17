# Activate accounts and the one-session trial

The code is ready, but sign-in is deliberately unavailable until a real Supabase project is configured. There are no mock accounts or browser-only trial credits. Existing marketing previews remain public. Full coaching sessions and AI endpoints require an authenticated account with an active trial.

## 1. Supabase and database

Use the project's Supabase project (or create one if it does not yet exist). Apply all four files in `supabase/migrations/` in filename order through your normal migration workflow or Supabase SQL editor. The accounts migration adds one row per auth account, RLS, and two server-only transactional functions; the subsequent platform migration adds the teacher/community workflow and private storage bucket. Follow `docs/TEST_READINESS.md` for the full setup check and acceptance run.

In Vercel → agr18 → plsteachme → Settings → Environment Variables, configure Production:

- `SUPABASE_URL`: project URL.
- `SUPABASE_ANON_KEY`: publishable/anon key, used for authentication.
- `SUPABASE_SERVICE_ROLE_KEY`: secret server key, used only for the trial ledger and existing storage.
- `NEXT_PUBLIC_SITE_URL`: `https://plsteachme.vercel.app` (or your verified custom domain).

Set the same keys locally in `.env.local` for local testing. Never commit keys or paste them into chat. Redeploy after configuration. The server also accepts `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` when already supplied by a Supabase integration.

## 2. Email links

Enable the Email provider, allow new registrations, and configure production SMTP delivery in Supabase. Set the Site URL to `https://plsteachme.vercel.app`. Allow these redirect URLs:

- `https://plsteachme.vercel.app/auth/callback`
- `https://plsteachme.vercel.app/auth/confirm`
- Local development equivalents, only if needed.

The default magic-link template uses the PKCE callback and should be opened in the browser that requested it. For cross-browser email links, use the Supabase template's token hash with `https://plsteachme.vercel.app/auth/confirm?token_hash={{ .TokenHash }}`. That handler accepts only the email verification type and always returns to `/account`.

Sign-up explicitly creates an account. Login does not create unknown accounts, and its generic confirmation avoids exposing registered email addresses. Email verification happens before a user can claim a trial.

## 3. Google and Apple

Configure both OAuth providers in Supabase using your own developer applications. The provider callback is the callback shown in the Supabase dashboard (`https://<project-ref>.supabase.co/auth/v1/callback`), not the app's callback above.

- Google: register the OAuth web application, authorized redirect URI, consent screen, and production audience. Then set `AUTH_GOOGLE_ENABLED=true` in Vercel.
- Apple: configure Sign in with Apple with your Apple developer Team, Service ID, key and client secret. Authorize your site and Supabase callback, register outbound email domains for private relay, and maintain the client secret's expiry. Then set `AUTH_APPLE_ENABLED=true` in Vercel.

Until each provider is configured, its button remains visibly unavailable and email is offered when available. Never set a provider flag merely to enable the button without its real OAuth setup.

Official setup: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [email links](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Trial behavior

A new account has one full coaching session. The credit is claimed only by clicking “Start my free session” for an available skill. Concurrent starts return the same session. That session can be resumed on the account; sign-out, another browser, or clearing local storage never issues a new credit. Completion closes it permanently. Prices remain “Coming soon”; there is no checkout or automatic charge.

Account identity is verified server-side with Supabase `getUser()`. The AI endpoints check account ownership, session ID, skill and completion. Database functions accept user IDs only from the server, are executable only by `service_role`, and the account key is unique. Ordinary authenticated users have read-only access to their own ledger row. Local drafts contain progress only; the database controls entitlement. Like any rule per account, it does not claim to prevent a person creating multiple separate accounts.

## Launch checks requiring the connected project

1. Sign up and sign in using an actual email link, Google and Apple; verify cancellation, expired links, signing out and session refresh.
2. Start a session on two tabs; verify one ledger row and one session ID.
3. Resume on another browser signed into the same account.
4. Finish, sign out/in, and attempt another skill or direct AI request; access must stay closed.
5. Confirm the Supabase provider and SMTP settings, redirect URLs, and secret expiry reminders.

The repository's unit tests and isolated PostgreSQL checks cover the logic and permissions. They do not replace these live-provider checks.

## Validation recorded for this implementation

- Production Next.js build and fresh TypeScript check passed.
- 136 unit tests passed, including sign-up intent, generic email confirmation, safe return destinations, sign-in form errors/focus, authenticated trial ownership, used-session rejection and fail-closed storage/configuration behavior.
- Applied the migration to an isolated PostgreSQL instance with representative `anon`, `authenticated`, `service_role` and `auth.users`/`auth.uid()` setup. Twelve concurrent claims produced one row and one session ID. RLS hid other users, anonymous reads and client mutations/RPC execution were denied, another account could not advance a session, and completion survived reclaims and stale progress writes. Temporary database was stopped after validation.
- Independent source review confirmed the UI extension and its shared mascot pause control. Mechanical design scan found no primary findings; type-ramp advisories reflect existing documentation drift and the inherited font sizes.
- Browser visual inspection was blocked by administrator-policy verification. Live OAuth/email and actual production Supabase configuration are not yet verified.
