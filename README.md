# plsteach.me

A warm, English-only landing and validation website for a practical-skills coach. The supplied hands logo, green/orange wordmark, interactive seven-step phone example and nine filterable skill previews lead into a waitlist and organization pilot form.

The latest landing design is preserved, and the functional coaching app is restored at `/coach`. The landing phone/module previews remain illustrative; **Try the coach** opens real camera practice or a watch-only walkthrough. See [Coaching setup and evaluation](docs/COACH.md) for Anthropic configuration, privacy, phone testing and skill authoring.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3100. For a production server, run `npm run build` then `npm start`. No environment variables are needed for local preview. With storage unconfigured, forms validate but save no data and clearly say so.

## Pages and implementation

- `/`: landing, phone example, module library, waitlist and FAQ.
- `/organizations`: pilot interest form.
- `/demo`: demo video slot and coaching link (defaults to `/coach`).
- `/coach`: practical lesson library, intake, live camera coaching, local progress/settings and evaluation.
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
| `NEXT_PUBLIC_DEMO_APP_URL` | Optional external override; defaults to `/coach` |
| `ANTHROPIC_API_KEY` | Server-only coaching key; missing key enables labeled simulations |
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

Run both SQL migrations in `supabase/migrations/` in filename order. The second extends vote support for laundry, cooking and bike care. Tables cover signups, votes, organization leads, follow-ups and an anonymous under-16 counter.

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

Hero preview: six module choices update the phone in place. The tie fabric moves through seven distinct, manually selected poses. Each move plays once, holds its result and can be replayed; it pauses offscreen or in a hidden document, with an immediate final-state reduced-motion alternative. Upcoming modules reuse the existing, explicitly labelled three-step text previews.

Logo exploration: `/brand/logo-directions.html` compares three vector concepts at display, header and app-icon sizes. Its local preview does not change the main site logo. SVG sources live under `public/brand/concepts/`.
