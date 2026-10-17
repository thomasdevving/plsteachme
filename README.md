# plsteach.me

A practical-skills learning app with nine illustrated starter lessons, automatic camera coaching, learning journeys, community requests and a reviewed teacher-contribution studio. The existing waitlist, organization forms and pricing remain in place.

The latest public frontend is preserved: the rotating hero phone, clay companions, module rail, account pages and planned Starter/Plus/Teams subscriptions. The dedicated `/coach` experience remains available alongside the expanded catalog. All nine skills have seven illustrated steps, preparation lists, checkpoints, navigation and a completion screen. The built-in lessons work without credentials or external services. Automatic camera coaching is built into the lessons and uses a server-only OpenAI key. Video and an external demo link remain optional.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 24. Open http://localhost:3100. For a production server, run `npm run build` then `npm start`. No environment variables are needed for local preview. With storage unconfigured, forms validate but save no data and clearly say so.

## Pages and implementation

- `/`: landing, phone example, module library, waitlist and FAQ.
- `/subscriptions`: existing coming-soon plans and pricing.
- `/login`, `/signup`, `/account`: shared account and one free coaching session.
- `/coach`: dedicated camera-coaching experience, intake, local progress and settings.
- `/organizations`: pilot interest form.
- `/demo`: all nine interactive lessons with optional automatic camera coaching, plus an optional demo video and external demo link.
- `/learn`: searchable skills, six real-life categories, learning journeys, saved progress and published teacher lessons.
- `/community`: request a skill and support other learners' requests.
- `/teach`: teacher applications, demonstration recording/upload, lesson editing, AI assistance and independent review.
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

Public environment variables require a rebuild. Never expose the Supabase service key in a `NEXT_PUBLIC_` variable. No credentials or actual demo/video URLs are bundled.

## Storage

Run all SQL migrations in `supabase/migrations/` in filename order. The second extends vote support for laundry, cooking and bike care. The teacher-platform migration adds community requests, teacher applications, private demonstrations, immutable submitted lesson versions, review records and consented feedback reports. See [platform setup](docs/PLATFORM.md).

RLS denies direct browser access, including INSERT. All writes pass server validation with a service-role client. Under-16 submissions discard email, free text, preferences and attribution; only the anonymous aggregate is incremented. Follow-ups use an opaque HttpOnly session cookie, never a query-provided signup ID. Mock mode logs no personal data and retains nothing.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
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
