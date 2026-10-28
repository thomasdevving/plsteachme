# Account confirmation email

The account confirmation is sent by **Supabase Auth**, including when Resend is
configured as its SMTP provider. It does not use `lib/email.ts`. Pushing this
repository to Cloudflare does **not** update Supabase's email templates.

## Activate in the connected Supabase project

1. Open **Authentication → Emails → Templates → Confirm signup**. Depending on
   the dashboard version, email templates may appear under **Notifications**.
2. Set the subject to **Confirm your email · plsteach.me**.
3. Replace the HTML body with the entire contents of
   [`confirm-signup.html`](confirm-signup.html), including the head and styles,
   then save.
4. Request a new confirmation from the signup page and check the delivered
   email on desktop and mobile. Previously delivered emails do not change.

The template uses the existing `{{ .ConfirmationURL }}` for both the button and
the copyable fallback link. Keep the Go-template expressions unchanged; do not
paste a preview URL or a real user's confirmation link into the template.
Default PKCE confirmation links should be opened in the browser that requested
signup. If this project already uses the cross-browser token-hash flow from
[AUTH_SETUP.md](../../AUTH_SETUP.md), replace **all three**
`{{ .ConfirmationURL }}` expressions with
`https://plsteach.me/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email`.
The template itself does not change authentication or link expiry settings.

## Design and assets

- Cream background `#faf7f2`, green text `#22372c`, orange button `#bb4827`.
- The original PNG hands logo is loaded from
  `https://plsteach.me/brand/hands-filled.png`; the wordmark remains readable
  when a mail client blocks external images.
- Email-safe table layout, inline primary styles, system fonts, fluid mobile
  width, and a fallback link if the button is unavailable. No scripts, tracking
  pixels, external fonts, or attachments.
- Browser previews check layout only. Outlook, Gmail, Apple Mail, image blocking
  and automatic dark-mode changes still need checks on an actual delivered
  email. The logo URL must remain publicly accessible over HTTPS.

Only the signup confirmation template belongs in **Confirm signup**. Do not
replace the password-recovery template with it: recovery has a different action
and return destination.
