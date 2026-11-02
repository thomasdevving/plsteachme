# Waitlist confirmation email and sender identity

Waitlist confirmations use the app's Resend API integration. Account confirmations/password reset emails are sent separately by Supabase Auth using its SMTP settings. Both should use the plsteach.me brand address.

## Configure production delivery

1. In **Resend → Domains**, add/verify `plsteach.me`. Copy the actual SPF/DKIM records Resend provides into Cloudflare DNS and wait for verification. Do not invent or reuse DNS values from an unrelated domain.
2. In **Cloudflare → Workers & Pages → plsteachme → Settings → Variables and Secrets**, configure:

| Name | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | A sending key authorized for the verified domain. |
| `ENABLE_CONFIRMATION_EMAIL` | Text | `true` (an explicit `false` disables sending). |
| `CONFIRMATION_EMAIL_FROM` | Text | `plsteach.me <contact@plsteach.me>` |
| `EMAIL_FROM` | Text | `plsteach.me <contact@plsteach.me>` for pilot/invitation emails. |

Save/redeploy the Worker so it receives the settings. Never paste API keys into chat or commit them. No new database migration or signing secret is needed.

A new registration attempts the branded HTML/plain-text confirmation before acknowledging mail success. Provider rejection/missing settings are not silently ignored: the entry stays saved and the form says that the email could not be sent, with a retry instruction. Retrying an existing email never exposes or replaces that entry's private browser session. Transient send failures get one bounded retry; the same provider idempotency key prevents duplicate sends within Resend's idempotency window. This is synchronous delivery acceptance, not a durable background mail queue or proof that a message reached the inbox. Check **Resend → Emails** for actual accepted/delivered/bounced status.

## Removal links

Each email contains a branded removal button and mailbox unsubscribe headers. Opening a normal link does not delete anything: the recipient explicitly confirms on `/unsubscribe`. This protects against email-scanner GET requests. Mailbox-provider one-click unsubscribe uses the standard RFC 8058 POST.

The removal proof is purpose-separated from the private waitlist session hash. It never exposes the browser cookie or the stored hash, does not depend on a new/global secret, and works while the associated row exists. Removal deletes only the matching waitlist entry; existing foreign-key cascades remove its follow-up answer and linked votes. It does not delete an authenticated learning account. Repeat removal is safe. The browser link carries its proof in a fragment so it is absent from normal page-request/referrer URLs; the one-click API URL must be treated as a private capability link.

## Remove a personal sender name/photo

Application mail now forces the display name **plsteach.me** and rejects sender addresses outside `plsteach.me`. The message body includes the existing hands logo. Configure the **Supabase Auth → Email/SMTP** sender name as `plsteach.me` and sender address as `contact@plsteach.me` too; deploying app code cannot change hosted Supabase SMTP settings.

**The picture beside a message in Gmail/Outlook is not controlled by the email HTML or From display name.** Depending on the recipient, it can come from a Google/Workspace account, a saved contact, cached sender information or verified brand-logo support. If the brand address is an alias of a personal Google account, use a separate business mailbox/identity with the brand photo instead of changing the personal account's photo globally. Set the business account photo through Google Workspace/account settings. The existing [square brand image](../public/icons/icon-512.png) is ready to upload. Alternatively, configure a dedicated verified sender such as `plsteach.me <updates@plsteach.me>` if `contact@plsteach.me` is linked to a personal profile; app replies still go to `contact@plsteach.me`. A recipient's saved contact photo can still override it. Domain-wide BIMI branding is a separate provider/DNS/certificate setup and is not enabled merely by putting a logo in the message.

## Verify with an address you own

Join the waitlist, check Resend's delivery log, and inspect the new message's actual From address/name in Gmail or another inbox. Check both HTML and plain-text links. Open the removal page and confirm that opening alone preserves the row; click removal and check that `public.waitlist` and its linked follow-up no longer contain that entry. Reopening the used link should be harmless. Also test a Supabase password-reset/account email separately if that is where the personal photo appeared. Previously delivered messages and cached avatars do not change when the template is updated.

This workspace has no production Resend/Supabase administration credentials. Automated tests use mocked delivery; they cannot verify DNS, hosted sender/profile settings or real inbox delivery.
