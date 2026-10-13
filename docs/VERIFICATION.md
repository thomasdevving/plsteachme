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
