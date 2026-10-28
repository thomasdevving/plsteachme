# plsteach.me

A practical-skills learning app with nine illustrated starter lessons, automatic camera coaching, learning journeys, community requests and a reviewed teacher-contribution studio. The existing waitlist, organization forms and pricing remain in place.

The latest public frontend is preserved: the rotating hero phone, clay companions, module rail, account pages and planned Starter/Plus/organization subscriptions. The dedicated `/coach` experience remains available alongside the expanded catalog. All nine skills have seven illustrated steps, preparation lists, checkpoints, navigation and a completion screen. The built-in lessons work without credentials or external services. Automatic camera coaching is built into the lessons and uses a server-only OpenAI key. Video and an external demo link remain optional.

Subscriptions are coming soon: Starter is $6/month, Plus is $20/month, and organization plans are $100–$500/month depending on the number of students. The organization training workspace at `/training` is in closed testing (allowlisted accounts only): plans set learner seats, and billing is not active. The `/subscriptions` page includes a compact testing-access request form using the existing waitlist endpoint, age checks and consent. Real requests require configured Supabase storage; mock mode clearly reports that nothing is saved. No paid checkout is enabled.

## Run locally

Accounts support email/username and password login, private first/last names, and optional private profile photos. Existing email-link users set a password through `/forgot-password` using the same address. Apply `supabase/migrations/20261027090000_account_profiles.sql` before deploying this version; see [AUTH_SETUP.md](AUTH_SETUP.md) for migration, email confirmation and recovery settings.

```sh
npm ci
npm run dev
```

Use Node.js 24. Open http://localhost:3100. For a production server, run `npm run build` then `npm start`. No environment variables are needed for local preview. With storage unconfigured, forms validate but save no data and clearly say so.

Before the public test phase, work through [the launch checklist](docs/LAUNCH.md). For connected testing after setting up Supabase and OpenAI, follow [the setup and acceptance checklist](docs/TEST_READINESS.md), then run `npm run verify:setup -- --url https://plsteach.me`. The checker only reads service configuration and reports missing setup without printing credentials or making AI inference calls. Email login becomes available when Supabase Auth is configured; each account receives one resumable free coaching session.

### Cloudflare Workers deployment status

Cloudflare Workers Builds should connect to this repository's `main` branch, use the repository root, and deploy to the existing Worker `plsteachme`. Set the deploy command to `npm run deploy:cloudflare` and leave the dashboard build command empty. This script explicitly runs the OpenNext build before calling `opennextjs-cloudflare deploy`. Dependencies must include development dependencies for the build tools. Node.js 24 is required.

Alternatively, set the dashboard build command to `npm run build:cloudflare` and the deploy command to `npx opennextjs-cloudflare deploy`. Do not use only `npm run build`: it builds Next.js but does not compile the OpenNext deployment configuration. Avoid relying on Wrangler's custom build hook: a real `wrangler deploy` delegates to OpenNext before that hook runs, while `wrangler deploy --dry-run` skips the delegation and can give misleading results.

`wrangler.jsonc` explicitly sets both the Worker name and the `WORKER_SELF_REFERENCE` service to `plsteachme`. Keep those names in sync: a service named `plsteach-me` does not refer to `plsteachme` and causes Cloudflare error 10143. Existing dashboard variables are preserved by `keep_vars`; configure build-time variables in Workers Builds and runtime variables/secrets on the Worker.

To validate the production build and OpenNext deployment pipeline locally without uploading the Worker, run `npm run deploy:cloudflare -- --dry-run`. This exercises the OpenNext deploy command as well as bundling. `npm run deploy:cloudflare` publishes to Cloudflare using the same build pipeline.

The Next.js proxy trace explicitly includes the ESM files from `@opentelemetry/api`, a production dependency. OpenNext resolves its ESM entry point when bundling Node.js middleware, whereas Next.js normally traces its CommonJS entry point. Keep this include to avoid `Could not resolve "@opentelemetry/api"` during middleware bundling.

An OpenNext build verifies bundling, not live service integrations. Server-side camera image processing still imports native `sharp`; verify these routes on the target runtime as well as the public pages before switching production hosting to Workers.

## Pages and implementation

The learning app is separate from the marketing site: `/learn` and `/account` use a focused header with the learner's account name. Lessons open on dedicated pages with viewport-sized steps and persistent navigation; the catalog no longer scrolls down to an inline player. See [learning navigation and lesson views](docs/LEARNING_UX.md).

- `/`: landing, phone example, module library, waitlist and FAQ.
- `/subscriptions`: existing coming-soon plans and pricing.
- `/login`, `/signup`, `/account`: shared account and one free coaching session.
- `/coach`: dedicated camera-coaching experience, intake, local progress and settings.
- `/organizations`: pilot interest form.
- `/demo`: all nine interactive lessons with optional automatic camera coaching, plus an optional demo video and external demo link.
- `/learn`: searchable skills, six real-life categories, learning journeys, saved progress and published teacher lessons.
- `/learn/offline`: downloaded lessons for offline practice and install help. plsteach.me installs as a desktop app (PWA) that opens in `/learn`; the nine built-in lessons can be downloaded and practiced without a connection, while accounts and AI coaching stay online. See [installable app and offline lessons](docs/PWA.md).
- `/community`: request a skill and support other learners' requests.
- `/teach`: teacher applications, demonstration recording/upload, lesson editing, AI assistance and independent review.
- Camera coaching can learn the learner's own object (“Show me the razor”) from a few views and track it on the live preview, entirely on the device. See [object enrollment and tracking](docs/VISION_MODELS.md#object-enrollment-and-tracking).
- `/vision`: vision lab. Record labelled landmark clips (no images), train a specialized per-lesson model with held-out evaluation, and activate it to run on learners' devices in shadow mode next to the cloud coach. See [specialized vision models](docs/VISION_MODELS.md).
- `/training`: organization workspaces. Admins create AI-guided modules from a camera-tracked demonstration or an uploaded manual, enroll students or employees, and monitor progress. Open to pilot organizations that staff grant access, plus their invited members; invitations are emailed when email is configured. See [organization training](docs/ORGANIZATIONS.md).
- `/insights`: staff-only learning overview: starts, completions, per-step drop-off and camera-coach verdict rates, from anonymous per-browser IDs.
- `/account`: signed-in learners' progress syncs across devices; learners can delete their account and its data.
- `/privacy`: visible draft with outstanding business/provider details.
- `/thanks`: honest mock acknowledgement or signup follow-up.
- `/dev/styleguide`: development only.

The public site is entirely English. Old `/en`, `/nl`, `/organisaties` and `/bedankt` links redirect to their English canonical URLs and preserve query parameters. Copy is in `messages/en.ts`; brand, routes and skill IDs are in `lib/config.ts`. Module preview content is in `lib/modules.ts`.

The logo is the supplied transparent PNG at `public/brand/hands-filled.png`. The brand colors are green `#22372c` and orange `#bb4827`; public pages always use the light cream canvas, including under a dark OS preference. The hands and lettering form one compact wordmark; the image has no tile. Fonts are self-hosted. Reduced motion disables animation, and the animated coaching loop pauses offscreen and in hidden tabs.

## Optional services

Copy `.env.example` to `.env.local` and set only the services you use:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical production origin, without trailing slash |
| `NEXT_PUBLIC_DEMO_APP_URL` | Actual coaching demo link |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Actual video URL |
| `SUPABASE_URL` | Server-only storage URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only storage secret |
| `CONTACT_EMAIL` | Public contact address |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | Empty/off, `plausible` or `umami` |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN` | Plausible domain |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | Umami script URL |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Umami website ID |
| `ENABLE_CONFIRMATION_EMAIL` | Defaults to false; opt in to Resend |
| `RESEND_API_KEY` | Server-only email secret |
| `CONFIRMATION_EMAIL_FROM` | Verified sender with monitored replies |
| `EMAIL_FROM` | Verified Resend sender for pilot and invitation emails (falls back to `CONFIRMATION_EMAIL_FROM`). With `RESEND_API_KEY`, invitations are emailed; without, admins copy the links |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the sign-in form; also enable Turnstile CAPTCHA (with its secret) in Supabase Auth |
| `AI_DAILY_CALL_LIMIT` | Service-wide AI calls per day before AI features pause (default 3000) |
| `TRIAL_MAX_AI_CALLS` / `TRIAL_MAX_MINUTES` | Free session limits (defaults 150 checks, 120 minutes) |
| `ENABLE_INTERNAL_TOOLS` | `true` shows `/coach/eval` and the `?debug=1` panel on a deployed site (staff testing only) |
| `MAINTENANCE_SECRET` | Random string of at least 24 characters; the daily retention job sends it as a bearer token to `/api/maintenance/retention` |

Public environment variables require a rebuild. Never expose the Supabase service key in a `NEXT_PUBLIC_` variable. No credentials or actual demo/video URLs are bundled.

## Storage

Run all SQL migrations in `supabase/migrations/` in filename order. The latest (`20261022090000_public_launch_safeguards.sql`) bounds the free session, adds the daily AI budget, shared rate limits, one free session per email address and hiding of community requests. Before it, `20261021090000_accounts_progress_insights.sql` adds account progress sync, anonymous learning events and insights, account deletion, retention cleanup and pilot access. Before it: organization training workspaces (`docs/ORGANIZATIONS.md`).

**Retention.** `.github/workflows/retention.yml` runs daily and calls the cleanup endpoint. Add the repository secret `MAINTENANCE_SECRET` (same value as the server variable) and optionally the repository variable `SITE_URL` (default `https://plsteach.me`). Without the secret the job skips. It deletes: resolved feedback reports 180 days after resolution (all reports after 365 days); teacher uploads never attached after 7 days and replaced or unused demonstrations after 30 days, with their files; unattached organization files after 7 days; learning events and on-device shadow checks after 400 days.

**Account deletion** removes the account's progress, trials, community requests and supports, teacher profile with its lessons, versions, reviews and demonstration files, organization memberships (anonymized so organization reports keep their counts) and organizations where they were the only member, then the sign-in account. An admin who is the only admin of an organization with other members must hand over first. The second extends vote support for laundry, cooking and bike care. The teacher-platform migration adds community requests, teacher applications, private demonstrations, immutable submitted lesson versions, review records and consented feedback reports. See [platform setup](docs/PLATFORM.md).

RLS denies direct browser access, including INSERT. All writes pass server validation with a service-role client. Under-16 submissions discard email, free text, preferences and attribution; only the anonymous aggregate is incremented. Follow-ups use an opaque HttpOnly session cookie, never a query-provided signup ID. Mock mode logs no personal data and retains nothing.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:pwa
```

Browser checks use Chromium on port 3100 and should run against `npm start` for production-only checks. They cover canonical redirects, attribution, age boundaries, mocked forms, server authorization, module/phone controls, mobile overflow, WCAG checks, dark OS preference and reduced motion.

For a migrated test Supabase project, `npm run verify:rls` verifies direct anon access is denied. Live storage, email and deployed performance require configured services; local mock tests do not verify those integrations. Historic planning documents in `docs/` describe earlier iterations; `docs/VERIFICATION.md` records this revision's checks.

Hero preview: the tie example cycles through seven steps, and the shared phone rotates into the demo as visitors scroll. The module rail opens all nine full lessons. Lesson animations play once, hold their result, replay and pause offscreen or in a hidden document; reduced motion shows static artwork. Full lessons add materials, prerequisites, safety limits, per-step evidence, common mistakes, a manual alternative and a checkpoint record. Browser-local versioned progress resumes across visits, with Reset and Practice again controls. Camera-confirmed visible checkpoints, self-checks and unresolved steps are reported separately. The hero stays illustrative.

Logo exploration: `/brand/logo-directions.html` compares three vector concepts at display, header and app-icon sizes. Its local preview does not change the main site logo. SVG sources live under `public/brand/concepts/`.

## Automatic camera coaching

Set `OPENAI_API_KEY` in `.env.local` or the deployment’s server environment, then restart/redeploy. `OPENAI_VISION_MODEL` defaults to `gpt-6-luna`; use an image-capable Responses API model available to your account. The key never goes to the browser. An optional `COACHING_SESSION_SECRET` separates session signing from the API key. Authenticated AI practice uses the existing Supabase one-session trial; illustrated practice needs no database. Without a key, lessons remain fully usable and camera coaching visibly reports that it is not connected.

In any full lesson, confirm age 16+ and consent, then select **Start camera coaching**. The browser requests camera access without microphone access. Checks happen automatically: a pair of resized JPEG frames, captured 600ms apart, is sent after camera startup; subsequent checks wait six seconds after the previous request completes. A high-confidence match to a visually checkable checkpoint records confirmation and advances after a cancellable four-second countdown. Learners can disable automatic advancement or stay on the current step. Uncertain, correction, hazard and nonvisual results never advance automatically. Pause stops image uploads, Resume restarts them, Switch camera changes the preferred facing direction, and Stop releases hardware. Switching lessons, completing/closing a lesson, hiding the page or leaving it stops the camera. The local preview may be mirrored; submitted images stay in camera coordinates.

Requests never overlap. Step changes, pause and stop cancel the current request; stale responses are ignored. Provider errors back off, then pause after three failures. Twelve inconclusive checks on a step also pause the loop. Network timeouts, permission denial, missing devices, session expiry and rate limits have recoverable states. An expiring signed HttpOnly cookie records consent authorization for the current browser session. Both coaching routes enforce same-origin requests; image checks require that cookie.

Frames are capped at 200KB each; request bodies are capped while streaming. The server fully decodes JPEGs, bounds input pixels, resizes to 640px and removes metadata before inference. Lesson instructions come from server-owned content, not client prompts. The AI returns validated structured feedback. Low-confidence matches/corrections become unclear; steps involving nonvisual properties (including drill operation and brake performance) cannot receive successful verification. Visible hazards pause coaching. Feedback is advisory and never automatically certifies safety.

The app saves no learner camera frames in files, databases, analytics or application logs. Sending an incorrect-feedback report requires separate consent and saves only the feedback text, skill, step and explanation for human review. Opening the report pauses coaching. Questions also require separate consent and never change progress. OpenAI Responses requests use `store:false`; this does not guarantee zero provider retention. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). Camera access requires HTTPS, with localhost supported for development. Microphone access is available in the teacher studio for an explicitly started demonstration recording and in the dedicated `/coach` for optional voice commands. Geolocation stays disabled.

The beta limiter is per server process: 30 session starts and 120 checks per network identifier per ten minutes, with a bounded in-memory map. Before scaling across instances, use a shared rate limiter and configure provider/project spend limits. A trusted reverse proxy must supply the network identifier. No public or unlimited-cost inference endpoint should be deployed without those operating controls.

Implementation references: [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision), [model catalog](https://developers.openai.com/api/docs/models), and installed AI SDK 7/OpenAI provider 4 bundled documentation. Live model quality and real mobile-device camera behavior need validation after credentials are configured.
