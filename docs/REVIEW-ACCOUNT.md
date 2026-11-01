# Y Combinator review account

Requested account: **ycombinatorw2026**, email **contact@plsteach.me**. Its password is deliberately absent from this repository. The account is not created by deploying this code.

## Provision the account

Run from a trusted local checkout after installing dependencies (`npm ci`). Configure your production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the ignored `.env.local` file or your shell environment. These are server/admin credentials; never put the service-role key in browser code or paste it into chat.

In Bash, enter the requested password at the hidden prompt:

```bash
read -rsp 'Review account password: ' REVIEW_ACCOUNT_PASSWORD
export REVIEW_ACCOUNT_PASSWORD
npm run provision:review-account
unset REVIEW_ACCOUNT_PASSWORD
```

The command creates a confirmed Supabase Auth account with the username and a profile named “Y Combinator Winter 2026”, then grants `app_metadata.coaching_access = "unlimited"` to its exact user ID. It checks that the profile trigger reserved the requested username before applying the grant. It never changes another account to resolve a username/email conflict. If the exact username and email already belong to the same account, rerunning updates that account's password and grant and preserves other admin metadata. Supabase remains responsible for hashing the password.

Wait for the main-branch Cloudflare deployment, then sign in at `/login` with the username and supplied password. `/account` should display **Unlimited coaching access.** Open coaching for two different available lessons to confirm that neither claims a one-time trial. Existing consent prompts still apply. Normal learning-progress sync remains enabled.

## Scope and controls

The grant removes the account's one-lesson, two-hour and per-trial AI-call caps for learning/coaching/questions. The server checks fresh Supabase `getUser()` data, never a client-supplied flag, username, email or editable user metadata. Other accounts retain their original trial rules. This is learner access, not reviewer/admin access to private teacher or organization content. Authentication, optional MFA, consent, endpoint throttles and the shared service-wide AI spending ceiling still apply.

No SQL migration or new Cloudflare secret is required. Account creation/grant requires Supabase admin access and cannot be inferred from a successful code deployment. The provisioning command logs no password or admin key.

## Remove unlimited access

In Supabase Auth's admin tools, remove the `coaching_access` key from this account's **app metadata**, or set it to `"limited"`. Keep its other metadata. Subsequent server checks use the updated provider record. Sign out and back in to refresh the displayed account status. Never grant access through `user_metadata` or an editable profile field.
