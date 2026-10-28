# Password accounts and private profiles

The app uses Supabase Auth for credentials and HTTP-only, secure session cookies. Login accepts an email address or a case-insensitive username plus a password. Passwords are never stored in account profiles or application logs.

## Apply the database migration before deploying

Apply every migration in `supabase/migrations/` in filename order to the intended Supabase project. For an existing installation, apply the new `20261027090000_account_profiles.sql` migration before deploying this version.

The new migration adds:

- `account_profiles`, with one private row per Auth user and a unique, lowercase username.
- A trigger that reserves a new username in the same transaction as account creation. A collision rolls the signup back.
- Backfilled profiles for existing accounts, without changing their user IDs, progress or trial entitlements.
- The server-only `account_login_email` function. Anonymous and ordinary authenticated clients cannot use it to discover email addresses.
- The private `profile-avatars` storage bucket, restricted to JPEG files of at most 256 KiB. The application proxies the signed-in user's own photo; it does not expose public storage URLs.

Authenticated database clients can read their own profile only. Profile updates and photo operations run on the server with a verified account ID. The application never accepts an owner ID from the browser.

## Hosting configuration

Set these on the production Worker or Node.js host:

- `SUPABASE_URL`: project URL.
- `SUPABASE_ANON_KEY`: publishable/anon key for Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for profile operations, private photo storage, username lookup, shared authentication limits and the existing platform. It also signs short-lived password-recovery cookies.
- `NEXT_PUBLIC_SITE_URL`: `https://plsteach.me`.

The server also accepts the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` variables. Never put the service key in a public variable or commit credentials.

The shared `rate_hit` function from `20261022090000_public_launch_safeguards.sql` is required. Credential attempts fail closed when the shared limiter is unavailable.

## Email provider and password recovery

Enable the Email provider, new registrations and email confirmation in Supabase. Configure production SMTP delivery. Set the Supabase Site URL to `https://plsteach.me`.

Allow redirects to the application's callback, including its query string. A narrowly scoped pattern is `https://plsteach.me/auth/callback**`; safe return destinations are also validated by the app. Configure localhost equivalents only for development.

The normal confirmation and reset email templates may use Supabase's `{{ .ConfirmationURL }}`. With the default PKCE flow, open the email in the same browser that requested it.

For direct token-hash links that work across browsers, configure these templates:

- Confirm signup: `https://plsteach.me/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- Reset password: `https://plsteach.me/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

A signup email confirms ownership once. Normal login uses the password, not an email code or magic link. Signup confirmation can be resent from the confirmation screen, subject to CAPTCHA and rate limits.

The branded signup confirmation is in [supabase/templates/confirm-signup.html](supabase/templates/confirm-signup.html). Apply it in Supabase Auth's **Confirm signup** email template with the subject **Confirm your email · plsteach.me**; see [activation instructions](supabase/templates/README.md). A Cloudflare deployment alone does not install this template. Its button and fallback use the existing `{{ .ConfirmationURL }}`.

Password recovery exchanges a valid provider token/code before issuing an HTTP-only recovery proof. It is signed, bound to the user, and expires after ten minutes. The password endpoint requires both the authenticated user and this proof. On success it clears the proof and requests sign-out of other sessions.

Existing email-link users should choose **Set your password** or **Forgot your password?**, using the same email address. They keep their existing account and progress; they should not create another account.

## Registration and profiles

Registration requires a first name, last name, email, username, password and age/terms agreement. Names support Unicode. Usernames use 3–24 ASCII letters, numbers or underscores and are stored lowercase. New passwords use 12–128 characters; whitespace is preserved.

After confirming the email and logging in, `/account` lets users edit their names and username, upload or remove a photo, manage their free session, sign out and delete their account.

Photos are optional. The browser accepts JPG, PNG or WebP up to 5 MB, crops to a 256-pixel square and exports JPEG without metadata. The server independently bounds bytes and dimensions, strips metadata and stores the file privately. Replacing a photo overwrites the previous object. Account deletion removes the photo before removing the Auth user; profile rows cascade with that user.

## CAPTCHA and optional social providers

Keep Turnstile configured in both Supabase Auth and the app using the existing `TURNSTILE_SITE_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` configuration. CAPTCHA tokens are forwarded for password login, signup, email confirmation resend and password recovery and refreshed after each submission.

Google and Apple remain optional. Their buttons are shown only when at least one provider is enabled; each provider must be configured in Supabase before its existing `AUTH_GOOGLE_ENABLED` / `AUTH_APPLE_ENABLED` flag is enabled. Social users can complete their profile on `/account`.

## Verify before publishing

1. Apply the migration, then run `npm run verify:setup -- --url https://plsteach.me`. It checks schema and private buckets without creating accounts or sending email.
2. Test signup and confirmation with a real email address and CAPTCHA.
3. Log in by both email and username, including different letter case, and test incorrect passwords.
4. Reset an existing email-link account's password; verify its account ID, trial and saved progress are unchanged.
5. Test expired/reset links, resending confirmation, sign-out and session refresh.
6. Save names, test a username collision, upload/remove a photo and check another account cannot fetch it.
7. Delete a disposable account and verify its profile and photo are removed along with existing account data.

Local unit, PostgreSQL and browser tests verify the implementation. Actual provider delivery, CAPTCHA and production configuration still require the connected project's acceptance checks.
