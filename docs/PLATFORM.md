# Learning and teacher platform

This implements the supplied product vision as a working early platform. Existing pricing, payment preference options and subscription behavior are unchanged. No monthly credit allowance, rollover, checkout, royalty percentage or payment processor has been introduced.

## Setup

Use Node 24, install the locked dependencies with `npm ci`, then run all four migrations in `supabase/migrations/` in filename order against the intended Supabase project. The platform migration is `20261017172015_teacher_platform.sql`. It creates private application tables and the private `teacher-demonstrations` bucket. It does not populate pretend teachers, lessons or request counts.

Configure:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Server-side project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key; never expose this in browser settings |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Auth URL (defaults to server URL in runtime config) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable key for email sign-in; a legacy anon key is also supported |
| `PLATFORM_REVIEWER_IDS` | Comma-separated Supabase Auth user UUIDs authorized to review |
| `OPENAI_API_KEY` | Server-only key for coaching and lesson drafting |
| `OPENAI_VISION_MODEL` | Image-capable Responses model; default `gpt-6-luna` |
| `OPENAI_TRANSCRIPTION_MODEL` | Audio transcription model; default `gpt-4o-transcribe` |
| `NEXT_PUBLIC_SITE_URL` | Canonical deployment origin |

Accounts use the existing shared HTTP-only cookie sign-in. Set `SUPABASE_ANON_KEY` (or the public publishable-key variable), enable email sign-in, and allow `/auth/callback` and `/auth/confirm` for the deployed origin. See `AUTH_SETUP.md`. The login return path supports `/learn`, `/community` and `/teach`. Configure a production email sender in Supabase before inviting contributors. Sign in once to create each account, then copy the intended independent reviewer's Auth user UUID into `PLATFORM_REVIEWER_IDS` and restart the server. Teacher approval and reviewer authorization are separate: neither a profile field nor user-editable account metadata grants review rights. An applicant cannot approve their own application; a teacher cannot publish their own lesson.

The app reports unavailable services honestly until configured. Built-in illustrated lessons and their local progress work without credentials. Apply migrations only to the intended linked project; deployment by itself does not configure Supabase.

## Contribution flow

1. Sign in, submit a teacher profile with practical experience and relevant qualifications.
2. An authorized reviewer approves it or requests changes with notes.
3. The approved teacher creates a lesson, optionally linked to a community request. Hosting/contribution permission is required. Future model-improvement permission is separate and off by default.
4. Record a demonstration in the studio or upload an MP4, WebM or MOV file (maximum 100 MB). Recordings are limited to five minutes. The browser preview stays local until Upload is selected. Signed upload destinations are scoped to the owner and lesson; attached files are checked against storage metadata.
5. Supply teaching notes, or request transcription of a compatible recording under 25 MB after agreeing to send it to OpenAI. Review the text. Optionally select still frames, then generate a structured lesson proposal from the text and frames. AI output is editable and is not automatically saved or published.
6. Define the objective, materials, prerequisites, safety limits, instructions, common mistakes, visible evidence, uncertainty behavior, manual alternatives and completion check. Review and save the draft, then explicitly approve it for independent review.
7. Submission records an immutable version. A different reviewer watches the demonstration, inspects the steps and either publishes that version or requests changes. Updates to a draft cannot change an already published version.
8. Published lessons appear under `/learn`. Learners can watch the demonstration, follow the checkpoints and start automatic coaching against the reviewed server-owned version. A changed/withdrawn version cannot silently become another lesson during an active check.

Teachers can withdraw publication from the studio. New public content, playback-link and coaching requests then fail. Already-issued video URLs expire after five minutes. Permanent removal of retained private media and immutable audit records is an operator process; business contact and retention details on `/privacy` must be filled in before public launch.

## Data and boundaries

All new tables have RLS enabled and direct `anon`/`authenticated` table/RPC access revoked. The server verifies the shared cookie account with Supabase `getUser`; authenticated bearer API clients are also verified server-side. Browser UI never receives the HTTP-only session token. Ownership and independent review are checked again inside the transactional service-only mutation function. Votes use a unique user/request key and derive their counts atomically. Submitted versions and review records reject mutation.

Private demonstration links last five minutes. Published content has no transcript or private upload path in its public response. Upload references cannot point to another teacher's file. Learner frames are resized, bounded and stripped of metadata before inference, and are not retained. Reports include text only and require separate permission. Human resolution of a report never retrains or deploys a model.

Progress is browser-local, versioned display data. It is not an entitlement, an externally certified achievement, or a paid-access credential. No cross-device progress sync is claimed. Built-in illustrations are labeled as illustrations; only actual published teacher uploads are presented as human demonstrations.

Rate limiting is intentionally bounded but per server process. A deployment with multiple instances needs shared limits and provider spend controls. Live Supabase Auth, email delivery, Storage behavior, model quality and physical mobile cameras need checks against the configured deployment; mocks and isolated PostgreSQL tests do not establish those external service guarantees.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`. Unit/API tests cover input limits, consent, auth, privacy, publication rules and conservative feedback. PGlite executes the actual migration and transactional mutations against isolated PostgreSQL; it stubs the Supabase Auth/Storage schema for the database tests. Browser tests use a production server, fake camera devices and mocked external responses. They cover journeys, search, resume/reset, automatic advancement, uncertainty, requests, teacher review and accessible mobile layouts.
