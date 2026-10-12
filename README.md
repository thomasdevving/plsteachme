# plsteach.me

Nobody should have to figure everything out alone.

A mobile-first practical-skills coach. **Phase 1 is implemented:** a complete, button-only four-in-hand tie lesson, beginner intake, seven diagrams, JSON-driven skill discovery and a tested coaching reducer. Shaving appears as coming soon.

This version does **not** use a camera, send images, call an AI service, speak, or judge a knot. The interface labels it as a walkthrough. Completing a step means the learner chose to continue, not that the step was verified.

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or API keys are needed for Phase 1. Fonts are bundled and served locally. There are no analytics or external font requests.

```sh
npm test
npm run typecheck
npm run build
npm start
```

The production build validates every skill and illustration before compiling. The Next.js project can be imported into Vercel using its standard Next.js settings; no services or environment variables are needed for this phase.

## Try the walkthrough

1. Pick the tie lesson and review the equipment and seven steps.
2. Answer both intake questions.
3. Follow each diagram and instruction. Use **Repeat**, **Show me again**, **Back** and **I’m done with this step**.
4. Leave the lesson and use **Continue your lesson** to resume in the same browser tab.
5. Complete all seven steps, read the tips, then practice again.

The temporary draft and intake answers use `sessionStorage`. They last for the browser tab and are removed when the lesson completes. If storage is blocked, the lesson still works in memory. Durable progress and IndexedDB are planned for Phase 4. Completing a walkthrough never stores a verified outcome.

Append `?debug=1` to `/session/tie-four-in-hand` to inspect reducer state and step records. This is an early state inspector, not the full evaluation mode.

## Browser checks

Start the production server in one terminal, then in another:

```sh
npx playwright install chromium
npm run test:browser
```

Alternatively, set `TEST_BROWSER_PATH` to a local Chromium-compatible executable. Tests cover the complete lesson, intake selection, replay, expanded demonstration notes, back navigation, resume, restart, missing skills and malformed drafts. Viewports are 375×812, 414×896 and 1440×1000. Screenshots are local review artifacts and are ignored by Git.

## Add a skill

1. Create `skills/your-skill-id.json`. Its filename must match `id`. Use `skills/tie-four-in-hand.json` as the available-skill example, or `skills/shaving.json` for a coming-soon stub.
2. Set a positive `version`, title, description, equipment, intake and camera setup. Available skills need at least one step; coming-soon skills require an empty steps array.
3. Give each step a unique ID, plain instructions, spoken instructions, a demo asset, strictness, named local prechecks, a rubric with pass criteria, unique error IDs and corrective cues, and a positive `maxAttempts`.
4. Put each diagram under `public/skills/your-skill-id/` and reference it as `/skills/your-skill-id/step.svg`. Paths must remain under `/skills/` and cannot contain `..`.
5. Use `strict` for clearly observable important endpoints, `light` for ambiguous intermediate moves and `none` for manual-only steps. Write directions from the learner’s own perspective. The current tie diagrams are front views, unmirrored; the learner’s right appears on the left of the drawing.
6. Add completion wording and practical tips. Keep corrective cues within 15 words. The walkthrough uses separate completion wording so it does not claim success without a check.
7. Run `npm run validate:skills`, `npm test` and `npm run build`. JSON files are discovered automatically; no registry or component changes are needed.

`lib/skills/schema.ts` is the schema authority. Shared interface copy is in `lib/copy/en.ts`; lesson-specific language stays in the skill definitions so adding skills needs no application code.

## Coaching engine

`lib/session/machine.ts` is a pure reducer. `lib/session/decision.ts` handles confidence and strictness, and `lib/session/config.ts` holds thresholds. These paths are tested now so camera and API work can plug into explicit events later.

```text
INSTRUCTING → PRACTICING → CAPTURING → VERIFYING
                                 ↘ REPOSITION
VERIFYING → PASSED / CORRECTING / REPOSITION / UNCERTAIN
PASSED → ADVANCE → next INSTRUCTING / COMPLETE
CORRECTING → PRACTICING, or OPTIONS at the attempt limit
UNCERTAIN → retry twice for strict steps, then OPTIONS
UNCERTAIN → ADVANCE for light steps, recorded as unverified
OPTIONS → replay / retry / manual continue (recorded as override)
```

The UI runs in walkthrough mode: **Done** goes directly from practicing to advance, with a `walkthrough` record. It does not fabricate capture, verification or model verdicts. Unit tests exercise the future live paths with synthetic events.

## Remaining phases

- Phase 2: camera setup, MediaPipe, lighting, stillness, ROI and frame capture.
- Phase 3: Claude verification, mock verifier, speech output and voice commands. Model identifiers and image-input formats must be checked against official documentation before implementation.
- Phase 4: Q&A, durable progress, full completion summaries, consent and delete-data settings.
- Phase 5: labeled evaluation records, metrics, model comparison and JSON/CSV export.
- Phase 6: physical-device performance, camera/API edge cases, HTTPS phone testing and final documentation.

No claim of camera accuracy, real-phone performance or model accuracy has been made or tested in Phase 1.
