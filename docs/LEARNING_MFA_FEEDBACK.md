# Learning catalog, feedback and two-step verification

## Enable in production

1. In the same Supabase project as the Cloudflare Worker, run these migrations in order, after the existing account migrations:
   - `supabase/migrations/20261030170000_lesson_feedback.sql`
   - `supabase/migrations/20261030171000_mfa_account_access.sql`
2. In Supabase Authentication's multi-factor authentication settings, enable authenticator/TOTP enrollment and verification. Phone/SMS MFA is not used by this app. Do not require MFA for every existing user in the provider: enrollment is optional per account.
3. Deploy the main branch through the existing Cloudflare build. No new environment variables or signing secrets are needed. Existing Supabase runtime keys and the durable `rate_hit` function must work.
4. Test with a real confirmed test account: Account → Two-step verification → Set up authenticator. Scan the QR code, keep a secure backup in your authenticator, then confirm with a six-digit code. Sign out and log in again: a valid code must be required before opening the account or accessing private APIs. Test incorrect codes, cancellation, and removal after a verified sign-in.
5. Open a lesson's Feedback tab. Submit a rating and optional comment, edit it and delete it. Confirm the date/version and aggregate update. Test a built-in lesson, a reviewed teacher lesson, and an assigned organization module.

Local tests use isolated mocks/database fixtures and cannot activate provider settings or production migrations.

## Recommendations and catalog

Recommendations use the browser's existing lesson progress, including newer account progress merged by the existing sync. Related learning journeys rank ahead of other categories. Already-practiced skills are excluded; in-progress lessons keep their separate resume section. A new learner gets labeled starter choices, not a claim of personalization. No OpenAI calls, extra tracking or learning-history uploads are added. If all skills have been practiced, no completed skills are presented as new recommendations.

The category strip uses tablist/tab/tabpanel semantics, a single keyboard tab stop and Arrow Left/Right/Home/End navigation. Narrow screens scroll the strip horizontally rather than widening the page.

## Feedback and lesson improvements

Feedback is requested explicitly in a separate lesson view. Each confirmed account has one rating/comment for each lesson and version. The database owns creation and update dates; edits preserve the original date. Older versions stay separate and appear only in the learner's own feedback history. Learners can delete their earlier feedback as well as update/delete current feedback. An old lesson version cannot accept a new review after publication advances.

Comments are private to the learner and authorized plsteach.me operators, not public community posts. Only the rating count and average for the current version are shared. Organization module reads and writes run the existing membership/assignment checks before any feedback is accessed. No member email, author profile or another person's comment is returned. The UI states these limits before submission. Rating counts reflect all submitted ratings, without claiming verified completion.

Operators can review comments in Supabase's restricted `lesson_feedback` table, filtering by `lesson_key`, `version` and server dates. Use administrative dashboard access only; do not grant browser roles direct access. This change does not add a staff moderation dashboard or automatically train models from comments. Account deletion cascades through all feedback rows. Comments are not cached by the service worker or sent to OpenAI.

Built-in lesson revisions use `LESSON_CONTENT_VERSION`; bump it when changing instructional content. Teacher and organization lessons use their published version number. Compare ratings within a version; the UI never merges old ratings into the new version's average.

## MFA enforcement and recovery

Supabase Auth owns TOTP enrollment, challenges and verification. All calls use the existing server cookie client, so tokens remain HTTP-only. The app returns a QR code/setup key solely during enrollment, as a private no-store response, and keeps it only in React memory. It never logs OTPs, seeds, QR codes or provider messages. Canceled or abandoned unverified factors can be removed/replaced.

After a provider-validated user has a verified factor, password-only (AAL1) sessions cannot use `authenticatedUser()` or the bearer-token platform API. Protected page navigation redirects to `/login/mfa` with a sanitized return path. Authenticated reads of the profile and trial tables also have restrictive database policies using Supabase's factor registry and the signed JWT assurance level. Browser-controlled profile metadata never determines whether MFA is required. Enrollment/removal is denied until existing MFA is satisfied. A password reset does not bypass MFA or remove factors.

Keep a secure backup through the authenticator app. The app does not currently issue recovery codes or provide a self-service lost-authenticator bypass. If every authenticator copy is lost, an authorized Supabase operator must verify account ownership through a separate support process before resetting factors; do not remove MFA based only on knowledge of an email address or a password-reset link.
