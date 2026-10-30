# Start testing AI learning on plsteach.me

This is the setup for the existing online learning app on Cloudflare Workers, Supabase Auth/Postgres and OpenAI's API. No second backend is needed to begin testing. Illustrated/offline practice works without AI; camera coaching and questions require the services below.

The application and automated tests can be prepared here. Production credentials, billing, Supabase project settings and the hosted confirmation-email template must be configured in your own dashboards. Never paste credentials into chat, commit them, or put private keys in `NEXT_PUBLIC_*` variables.

## 1. Cloudflare: use the existing Worker

Open **Workers & Pages → plsteachme** (the Worker name has no hyphen).

- Use **Workers Paid** for this Next.js/OpenNext app. The previous production logs showed `exceededCpu` at the Free plan's 10 ms limit. In the Worker's CPU limit setting, use the Paid default of **30,000 ms**, rather than keeping a custom 10 ms limit. This is an upper bound per invocation, not the expected CPU use of each visit.
- Connect production builds to `thomasdevving/plsteachme`, branch `main`, repository root.
- **Build command:** leave empty. **Deploy command:** `npm run deploy:cloudflare`.
- Use Node **24** and install development dependencies during the build.
- Under **Builds → Variables and secrets**, add `NEXT_PUBLIC_SITE_URL=https://plsteach.me`. This value is public and must be available during the build.

Under **Settings → Variables and Secrets**, add the following **runtime** settings. Build-only secrets do not make the deployed Worker able to call Supabase or OpenAI.

### Runtime secrets

| Name | Exact source/value to enter |
| --- | --- |
| `SUPABASE_ANON_KEY` | Supabase → project settings/API keys → **publishable key** (`sb_publishable_…`) or legacy **anon** key. Never use the service-role key here. |
| `SUPABASE_SERVICE_ROLE_KEY` | The same Supabase project's **secret key** (`sb_secret_…`) or legacy **service_role** key. Keep server-only. |
| `OPENAI_API_KEY` | A project API key from the OpenAI API dashboard, with permission to create Responses and access the chosen model. Model-read permission is needed for the optional local metadata check. |
| `COACHING_SESSION_SECRET` | A new, independent cryptographically random value. Generate with the command below. |
| `MAINTENANCE_SECRET` | Another independent random value, also entered in GitHub below. |

Generate each random secret **on your own computer**, twice for two different values:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### Runtime text variables

| Name | Value for the first controlled test |
| --- | --- |
| `SUPABASE_URL` | Your project origin, e.g. `https://YOUR_PROJECT_REF.supabase.co` — not a dashboard link or database connection string. |
| `NEXT_PUBLIC_SITE_URL` | `https://plsteach.me` (set here **and** in build variables). |
| `OPENAI_VISION_MODEL` | `gpt-5-mini` — the starting default. The OpenAI project must have access; the connection check below verifies it when credentials are available. An explicit existing model override is respected. |
| `AI_DAILY_CALL_LIMIT` | `100` (service-wide call cap for the initial private test, enforced through the database). |
| `TRIAL_MAX_AI_CALLS` | `50` (per free coaching session). |
| `TRIAL_MAX_MINUTES` | `120`. |
| `MOCK_VERIFIER` | `false` — the real AI test must not use simulated feedback. |
| `AUTH_GOOGLE_ENABLED` | `false`, unless you have configured Google in Supabase. |
| `AUTH_APPLE_ENABLED` | `false`, unless you have configured Apple in Supabase. |
| `ENABLE_INTERNAL_TOOLS` | `false` for this learner test. |
| `CONTACT_EMAIL` | An address you actually monitor. |

You do not need reviewer accounts, transcription, Resend API keys, organization access or vision-model training for the first built-in camera lesson. They are separate features. Do not add placeholder keys to make a readiness check appear green.

Save the settings, then **redeploy**. The existing `WORKER_SELF_REFERENCE` service binding must continue to point to `plsteachme`; leave the checked-in Images and Assets bindings intact.

## 2. Supabase: database, password accounts and email

Use a Supabase project you control. For an existing project, apply only missing migrations; do not erase existing users or progress. For a new project, run every SQL file under `supabase/migrations/` in filename order. There are twelve migrations, ending in `20261030203000_restore_progress_sync.sql`. The October 30 migrations add private lesson feedback and enforce opted-in MFA on direct account reads.

In **SQL Editor**, run [the read-only readiness query](../supabase/checks/ai-learning-readiness.sql). Every row should report `ready = true`. This checks the learner tables, required functions and private profile-photo bucket without creating users, consuming AI budget or altering data. If a row fails, apply the migration that creates it. In particular, missing `rate_hit` prevents registration/login; `coaching_trial_use` and `ai_budget_use` are required for AI calls.

In **Authentication**:

1. Enable the **Email** provider, new registrations and email confirmation. Normal login uses email/username **plus password**.
2. Under **URL Configuration**, set **Site URL** to `https://plsteach.me`. Allow the narrowly scoped callback patterns `https://plsteach.me/auth/callback**` and `https://plsteach.me/auth/confirm**`. Configure localhost separately only if you will test locally.
3. Configure **custom SMTP** with your email provider's actual server, port, credentials and verified sender. A ChatGPT subscription and an OpenAI API key do not provide email delivery.
4. Under **Emails → Confirm signup**, paste [the existing branded HTML](../supabase/templates/confirm-signup.html). Subject: **Confirm your email · plsteach.me**. Deploying the Worker does not apply this hosted template.
5. For the default confirmation link, open the email in the browser that requested it. For confirmation across browsers/devices, replace all three `{{ .ConfirmationURL }}` occurrences in the template with `https://plsteach.me/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email`, as documented in [the template guide](../supabase/templates/README.md).
6. Keep any existing CAPTCHA protection. To enable Turnstile, configure its secret in Supabase Auth, add `plsteach.me` to the widget's allowed hostnames and set the matching **site key** as `TURNSTILE_SITE_KEY` on the Worker. Do not put the Turnstile secret in that variable. Optional local testing can use a separately configured test widget.

The private `profile-avatars` bucket is created by the profiles migration; do not make it public. Accounts, photographs and progress remain private.

## 3. OpenAI project and cost controls

Create or choose an OpenAI **API project**, enable API billing and create the project key used above. A ChatGPT subscription is separate from API billing. Configure project usage alerts and a small testing allocation; do not assume a monthly alert itself is a hard spending stop. The application's daily **call** cap is enforced separately and is not a dollar budget.

The app sends individual still images and questions to the API with response storage disabled. It does not stream live video. Keep API keys server-only. Read the existing privacy notice before using a real camera.

## 4. Keep retention cleanup configured

In GitHub → repository **Settings → Secrets and variables → Actions**, add repository secret `MAINTENANCE_SECRET` with the exact same value as the Worker secret. Optionally set repository variable `SITE_URL=https://plsteach.me` (already the workflow's default). Run **Actions → Retention cleanup → Run workflow** and inspect its outcome. That workflow deletes expired application records/files, so run it only against the intended project; it intentionally fails when its secret is missing.

## 5. Run the checks

### Deployment check — no keys on your laptop, no AI charges

From a checkout with Node 24 and `npm ci` completed:

```sh
npm run verify:learning
```

This checks `https://plsteach.me/api/coaching/session`, `/api/auth/session` and `/api/health`, without sending server credentials. All should pass after deployment. It verifies configuration/basic database reachability; it does not prove migrations, model permissions, billing, email delivery or coaching quality. Use the SQL query and real lesson below too.

### Full learner infrastructure check — optional local server credentials

If you have securely configured a gitignored `.env.local` for your test project:

```sh
npm run verify:setup -- --learner --url https://plsteach.me
```

This checks learner tables, denied anonymous access, database functions, private avatar storage and model metadata without writes or inference. It does **not** require teacher/reviewer accounts or transcription-model access. Never send or commit `.env.local`.

### One real image/API check — explicitly opt in to one billed request

Using the same private local environment, with `OPENAI_API_KEY` and `OPENAI_VISION_MODEL`:

```sh
npm run verify:ai -- --confirm-api-call
```

This sends the existing **public brand icon**, not a camera image, in one bounded Responses API request and validates structured output through the same provider adapter. Response storage is disabled, the call times out after 30 seconds and it is not retried automatically. It does not access learner trials or your database. The result prints no API key or raw provider output. It confirms this local project's image/model/billing access, not the deployed camera workflow or pedagogical accuracy.

## 6. First real learning session

1. Open `https://plsteach.me/signup` online. Create a disposable **16+ test account using an email you own**, confirm the email, then log in with email/username and password. Verify your username appears in the learning header.
2. Open `https://plsteach.me/learn/tie`. Use a real tie, a stable phone/laptop camera and good light. Keep the tie/knot visible; the illustrated instructions remain available throughout.
3. Select **Coach → Start my free session**, then accept the image-analysis notice and age/consent checkboxes. Choose **Start camera coaching**, then allow browser camera access. Start the session only once you are ready: it is time/call bounded.
4. Try a clear view, cover the knot briefly and show an incorrect arrangement. Feedback should respond to visible evidence; uncertainty must not pass the step. Ask one short question about the current step. Do not use higher-risk tasks for the first functional test.
5. Test **Pause**, **Stop**, switching to **Step**, denying camera permission, and briefly losing the connection. Uploads/tracks should stop where appropriate; reconnecting must not restart the camera by itself. Illustrated practice and local progress should remain usable.
6. Reload and resume the same trial. Record whether feedback is helpful and whether each checkpoint stays self-checked, camera-confirmed or unresolved as appropriate.

Existing accounts get **one free lesson session**, as before. Deleting/recreating the same email does not reset the claim. Use separate verified disposable test accounts for separate skill trials; do not delete real entitlements or remove budget/authorization checks. Payment subscriptions and unlimited testing access are not enabled by these settings.

For a full teacher-created learning test afterwards, also configure an independent confirmed reviewer in `PLATFORM_REVIEWER_IDS`, use a separate teacher account, and set `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe` if testing recordings. Follow [the connected acceptance guide](TEST_READINESS.md); reviewer approval must not be bypassed.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cloudflare error 1102 / `exceededCpu` | Workers Paid and CPU setting; inspect the failing request in Observability. |
| Signup says temporarily unavailable | SQL readiness, especially `rate_hit`, `account_profiles`, `account_login_email`; runtime Supabase credentials. |
| No confirmation email | Supabase SMTP, sender/domain verification, Auth email logs, spam folder and allowed redirects. |
| Coach says not connected | Runtime `OPENAI_API_KEY`, redeploy, `/api/coaching/session`. |
| Camera works but feedback fails | OpenAI project billing/model permissions, one-call check, database budget/trial functions; Worker logs such as `ai.quota`, `ai.rate_limited`, `ai.timeout`. Do not copy images, tokens or raw provider errors into logs. |
| Free session unavailable | `/account` shows the existing reservation/completion; resume that same lesson or use a fresh verified testing email. |
| Download works, AI does not work offline | Expected: only illustrated lessons work offline. Reconnect and explicitly restart coaching. |

Only call the setup complete after signup/email, the real deployed AI lesson, resume and stop/reconnect behavior all pass. Automated fixtures alone cannot establish live readiness.

## Persistent account progress sync errors

A GET `/api/progress` response with `error: storage` means the authenticated read of `learner_progress` failed. It does not by itself prove a missing migration, and the `progress_save` function is only used by POST requests.

Run [the read-only progress diagnostic](../supabase/checks/progress-sync-readiness.sql) in the Supabase project configured by the Worker's `SUPABASE_URL`. It checks the table, exact columns, service-role SELECT/INSERT/UPDATE grants and exact save-function signature/EXECUTE grant without reading learner rows. All seven checks must be true. If not, repair the specific failed prerequisite; do not blindly rerun an already-applied migration. The original definitions are in `20261021090000_accounts_progress_insights.sql`.

On Cloudflare, filter Workers Logs by `progress.storage_failed`. The record contains only the operation (`read` or `write`) and a standard database code, with no account ID, tokens, progress content or raw provider messages:

- `42P01`: missing relation; `42703`: missing column.
- `42501`: database permissions denied.
- `PGRST205`: PostgREST cannot find the table in its schema cache; distinguish an absent table from a stale schema cache using the SQL diagnostic.
- `PGRST202`: save function absent or not discoverable with the expected arguments.
- JWT/authentication errors: check that the server-only `SUPABASE_SERVICE_ROLE_KEY` belongs to the same project as `SUPABASE_URL` and is not a publishable/anon key. Redeploy after correcting runtime secrets. Never paste the key into chat or logs.

If SQL checks pass but PostgREST reports stale schema metadata, an operator can run `NOTIFY pgrst, 'reload schema';` in that project. Retest `/api/progress` while signed in and then **Retry sync**. Keep the browser's local data until cloud synchronization succeeds.

If all seven progress checks are false, the selected project has neither the progress table nor its save function. Run [the targeted progress repair](../supabase/migrations/20261030203000_restore_progress_sync.sql) in the project matching the Worker's `SUPABASE_URL`, then rerun the diagnostic. The repair creates the missing table, recreates the monotonic save function, restores server-only grants/RLS, and reloads the PostgREST schema cache. It preserves existing users and progress and is safe to rerun against the expected schema. It does not rerun unrelated migrations or provision other missing features. With all seven checks true, reload the learning page and choose **Retry sync**; the existing browser copy can then upload normally. No website redeployment is required for this SQL repair.
