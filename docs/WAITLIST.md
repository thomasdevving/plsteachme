# Waitlist-only registration

`/signup` is the early-access waitlist. It collects email, age bracket and consent through the existing `/api/waitlist` endpoint, not Supabase Auth signup. Existing members keep the same login, MFA and password recovery. The app rejects direct `action: "signup"` requests with a waitlist message before contacting the auth provider. Admin-created/invited accounts, including the review-account provisioning command, remain supported.

The number displayed on the waitlist page is the exact total of rows in the existing `public.waitlist` table (one unique email per row). `GET /api/waitlist` returns only `{count}` and uses a head-only database query. It exposes no emails, names or individual records, and does not change RLS. The aggregate can be cached for up to one minute; an open, visible page checks again every minute. An unavailable/unconfigured database shows an unavailable message, never a fabricated number or zero. Waitlist submission remains separate from counting.

## Hosted Supabase setting

To prevent registration through direct Supabase API requests or new Google/Apple identities as well as through the app, open **Supabase → Authentication → Sign In / Providers → Allow new users to sign up** and turn it **off**. Keep the email and any existing social sign-in providers enabled so existing members can still log in. Admin invitations/account creation remain the operator's route for granting test access.

This hosted setting cannot be changed by deploying the repository. The workspace has no Supabase management access; apply it in the production project's dashboard. The app-side password-registration endpoint is already closed by this change.

The waitlist uses the existing base migration `supabase/migrations/202610130001_waitlist.sql` and existing server credentials. No new migration or Cloudflare secret is needed for a project that already has the waitlist table. Confirmation/update email delivery depends on the existing optional mail-provider configuration.
