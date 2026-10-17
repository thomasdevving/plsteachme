# Verification — landing website replacement

Verified locally on 13 October 2026 against the production build. This revision replaces the prior walkthrough website on GitHub main with the selected landing design.

## Passing checks

- `npm test`: 16 validation and server authorization tests.
- `npm run typecheck`: passes.
- `npm run build`: passes with static English pages and server-only form endpoints.
- `npm run test:e2e`: all 10 production browser tests pass.
- English canonical routes and legacy redirects preserve campaign/referral query parameters.
- First-touch attribution, honest mock acknowledgement, organization form and age-gated skill votes.
- Under-16 submissions send no email, free text, attribution or skill choices.
- Invalid, cross-origin, oversized and honeypot requests; follow-up identity comes from the server session.
- Phone step navigation, nine modules, category filters, preview steps and focus restoration.
- Axe WCAG 2/2.1 A/AA checks on home, organizations, demo and privacy at 375px and 1280px; dark mode and reduced motion also pass.
- No horizontal overflow in the tested viewports.

## Bounded visual review

One batched review covered desktop, mobile, dark mode and module previews. The single confirmation round verifies that the feedback balloon clears the phone instruction, the supplied logo remains visible in dark mode, and category/mentor text has sufficient contrast. The finish reviewer found no material blocker within this scope. Local screenshots live in ignored `.impeccable/review/`.

## Integration limits

Supabase and Resend were not configured. Tests exercise mock forms and mocked server storage boundaries, not a live database or email delivery. Run both SQL migrations before enabling real storage. Actual demo/video links remain optional configuration. The privacy page intentionally retains visible business/provider TODOs. Historical performance reports describe previous revisions and are not scores for this build.

## Mobile performance

One local production Lighthouse run after visual corrections measured Performance 94, Accessibility 100, Best Practices 100 and SEO 100, LCP 2.73s, TBT 140ms and CLS 0. The score target of 90 is met; the simulated LCP goal below 2.0s remains open. This is a local laboratory result, not deployed field performance. An additional label/name consistency finding in that report was corrected in the module buttons and is verified by a targeted browser rule; no further visual or performance tuning loop was run.

## Cream canvas and wordmark refinement

The latest user direction keeps public pages light even when the OS prefers dark mode. The main canvas is #faf7f2; the former green story band is #f5f0e7. Header and 404 pages share the compact, transparent BrandMark lockup. A batched 375px/1280px visual check confirms the colors and no overflow. The two relevant browser checks pass, covering WCAG accessibility on four pages, dark OS preference and reduced motion. The production build was rerun for this refinement; form/server implementation is unchanged.

## Hero modules and moving tie

The hero now offers six selectable skills linked to the phone. Upcoming skills reuse the existing three-step text previews and remain explicitly labelled; the tie keeps seven manual sample steps. Its SVG fabric visibly morphs through a simplified wrap, with pause/play and automatic suspension offscreen or in a hidden document. Reduced motion shows a static illustration.

Production build passes. Five relevant browser tests pass, including all six hero choices by keyboard, step navigation, actual changing fabric geometry, pause/resume, offscreen suspension, reduced motion, label/name consistency and WCAG checks. A batched visual check at 375px, 768px and 1280px found no horizontal overflow or browser errors. All fifteen upcoming hero instructions fit within the fixed phone screen at mobile and desktop widths. The module reveal preserves full text opacity after correcting a transient contrast finding. Screenshots are local ignored review artifacts. Server/form implementation is unchanged; the earlier full-suite and Lighthouse results remain historical.

## Lesson-specific tie movement and logo concepts

The repeating wrap is replaced by seven distinct front-view poses. Next/Back animate from the previous displayed pose to the selected lesson; each 1100ms move holds its final state. Replay repeats the current move, and restarting restores the first pose. The animation uses native Web Animations without new dependencies, pauses offscreen/hidden, and displays the current final pose immediately with reduced motion. The illustration remains a simplified sample. Sequence checked against [TieMart’s four-in-hand instructions](https://www.tiemart.com/blogs/tiepedia/how-to-tie-a-four-in-hand-knot); all artwork is original project geometry.

Three downloadable SVG concept marks are compared at `/brand/logo-directions.html`, with live local header selection and small app-mark examples. The main site retains the supplied logo pending a user choice. The comparison page is marked noindex.

Production build and seven relevant browser checks pass, including seven distinct final poses, Back/restart/reduced motion, finite playback/replay/offscreen pause, logo preview selection, module navigation, label/name consistency and WCAG checks. One batched desktop/mobile review inspected all seven static poses and the three logo options; no overflow or page errors were found. No new Lighthouse measurement was taken for this narrow change.

## Guiding touch refinement

B retains solid overlapping hands and Lora. Smoothed palm contours, a tighter optical viewBox, slight opposing hand angles and a thinner cream separation improve its silhouette. Em-based mark sizing and tighter wordmark spacing improve the header lockup. B is the comparison default. A batched 375px/1280px check confirms loaded SVGs, correct selection and no overflow; the existing logo preview browser test passes. Only static logo/HTML assets and documentation changed, so the application build was not rerun.

The subsequent B adjustment reduces only the green hand’s silhouette and refines finger/palm contours. A single batched 375px/1280px header and app-mark review confirms loaded SVGs and no overflow. No application code changed; no new build or tests were needed.

## Selected supplied filled-hands logo

The user’s `ChatGPT-afbeelding 13 okt 2026, 13_28_11.png` is preserved byte-for-byte at `public/brand/hands-filled.png` (SHA-256 `5ed2894d4e7cb9f851541c376e1de41b4e73ae14e75ca4d919fdee308f1b0694`). It replaces the earlier outline mark in the shared header/404 BrandMark, footer and browser/apple icon metadata. Next Image serves appropriately sized header/footer images; the supplied source is unchanged. Existing compact optical sizing and brand text colors remain.

Production build and four relevant browser checks pass, including mobile/desktop WCAG checks, no horizontal overflow, dark OS/reduced motion, module controls and concept-preview isolation. One batched 375px/1280px visual check confirms the transparent cream-backed header/footer presentation, loaded optimized images and the new icon URL. Earlier vector concepts remain review references rather than the selected identity.

## Complete illustrated modules — 17 October 2026

Story: choose any of nine skills in the hero, filtered library or `/demo`, follow the shared seven-step lesson, check each instruction, finish, review and restart. The lessons are client-side and need no external service.

Verified against a completed local production build:

- `npm test`: all 16 validation and server authorization tests pass.
- `npm run typecheck`: passes.
- `npm run build`: passes.
- `npm run test:e2e`: all 19 production browser tests pass, including five new module tests.
- All nine full lessons complete, review their final step and restart; materials, checkpoints, artwork labels and semantic progress agree with lesson content.
- All nine hero selections use shared instructions and reset appropriately on module changes; library close restores focus and filtering closes the lesson.
- New illustration motion plays once, holds, replays, pauses offscreen and finishes when reduced motion is enabled. All 63 steps have static reduced-motion artwork.
- Axe WCAG A/AA checks and overflow checks pass at 375px and 1280px, including expanded lesson materials. Removed the inherited opacity animation from lesson text after it produced a transient contrast finding.
- A desktop/mobile visual review and an eight-module artwork contact sheet confirm readable instructions, original SVG scenes and the existing cream/green/orange brand. The completed walkthrough test records no browser page errors.

No new dependencies, API routes or database changes. Supabase and email remain unconfigured and were not live-tested; existing mock form tests pass. Camera/AI coaching is not implemented or implied by these illustrated walkthroughs. Completion is a self-check in transient client state, without automatic verification or saved progress. No new Lighthouse or deployed performance claim is made.

## Automatic camera/AI coaching — 17 October 2026

Story: open a full lesson, confirm age and consent, start the camera, receive automatic feedback for the selected step, adjust while checks repeat, then move on at your own pace. There is no manual check/capture button. The hero remains illustrative.

Verified against the completed local production build:

- `npm test`: all 35 unit/API tests pass (19 new coaching tests and the existing 16 validation/authorization tests).
- `npm run typecheck` and `npm run build`: pass, including the two dynamic coaching API routes.
- `npm run test:e2e`: all 30 production browser tests pass, including 11 camera-coaching tests using Chromium’s simulated camera and mocked AI responses.
- Automatic first checks and automatic retries for unclear feedback; matching results stop repeated checks until the next step. There are no overlapping requests or manual check controls.
- Consent precedes camera access; capture requests audio:false. Permission denial remains recoverable and does not break lesson navigation.
- Pause prevents uploads, Resume restarts checks, hidden pages stop all tracks, and lesson switches/completion release hardware. A permission request resolving after Stop immediately releases its newly obtained tracks.
- Step changes cancel pending checks and stale responses cannot update the new step. Hazard/rate feedback pauses checks. Expired sessions/unavailable services release the camera and clear the busy state.
- Signed HttpOnly consent sessions, origin checks, request/streamed-body limits, bounded JPEG decoding/resizing, corrupt/decompression input rejection, server-owned lesson prompts, storage-disabled provider requests, conservative confidence/nonvisual handling and sanitized errors.
- Mobile coaching controls/feedback pass Axe WCAG A/AA checks and have no horizontal overflow. Existing four-page mobile/desktop accessibility and overflow tests also pass. The provider policy URL is rendered as a readable link after an overflow finding.
- A batched visual review inspected consent and active coaching on desktop and at 375px using a simulated camera. The current instruction/checkpoint, automatic status, controls and feedback remain readable. Existing brand and illustration styling are preserved.

The user will add the OpenAI API key after the build. No live paid OpenAI request was made, so model accuracy, latency, account/model availability and real mobile camera behavior remain to be checked with credentials and real devices. API tests mock only the provider generation; they exercise actual request validation, cookies and image decoding. Browser checks use simulated camera input and intercepted coaching responses. Missing-key behavior is checked against the actual local API.

No camera image or feedback persistence is implemented. OpenAI receives resized stills with store:false; provider retention is disclosed and zero retention is not claimed. The beta rate limiter is per process, with shared limits/provider spend controls required before scaling. Node.js 22+ is required by the installed AI SDK 7/OpenAI provider 4. Supabase and email remain unchanged and were not live-tested. No new deployed performance claim is made.

## Expanded learning and teacher platform — 17 October 2026

Story: a learner discovers a skill or requests one; an approved teacher records and structures a demonstration; an independent reviewer publishes an immutable version; learners practice with automatic camera checks, contextual questions and a checkpoint record.

- `npm test`: 82 tests passed across validation, routes, coaching, learning progress, questions/reports, platform APIs and isolated PostgreSQL.
- `npm run typecheck`: passed. `npm run build`: passed, including all new public pages and dynamic APIs.
- Full production browser run: 52 of 53 passed. The remaining test identified a transient low-contrast Next button while its disabled opacity faded after progress hydration. Removed that opacity transition, rebuilt, then reran the three relevant accessibility suites: all 3 passed (camera, expanded lessons, and all existing page layouts at mobile/desktop sizes).
- Browser coverage includes camera consent/cleanup, high-confidence automatic advancement, cancellation/opt-out, nonvisual/uncertain results, resume/reset, questions and consented text-only reports for both built-in and published lessons, community support, teacher applications, video/audio recording, upload, transcription, editable AI proposals, independent review, published progress, and switching between lesson types.
- PostgreSQL tests execute the actual migration using PGlite with stubbed Supabase Auth/Storage schemas and the actual service_role grants. They exercise duplicate voting, ownership, stale submission/review rejection, publication, withdrawal, immutable history and denied anon/authenticated table/function access.
- Desktop/mobile captures show no horizontal overflow; microphone permissions are enabled only for the teacher studio. Native media tests use simulated camera/audio devices. External API/Auth/Storage responses are mocked in browser/API tests; no paid OpenAI request was made.
- The pricing regression asserts the original free-demo FAQ and payment preference options. No subscription, credit, checkout, rollover or royalty implementation was changed.

Live boundaries: the available remote Supabase project had an empty public schema and no repository link, so it was inspected read-only and left unchanged. Apply the checked-in migrations to the intended project, configure Auth redirects/reviewers and server credentials, then verify real email delivery, uploads/playback, provider output and physical mobile cameras. See `docs/PLATFORM.md` and `.env.example`. No production deployment or remote schema mutation was performed.
