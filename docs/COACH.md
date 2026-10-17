# plsteach.me

Nobody should have to figure everything out alone.

A mobile-first visual coach for the **four-in-hand tie knot**. Seven JSON-defined steps, illustrated demonstrations, mirrored camera preview, on-device framing/light/motion checks, OpenAI step verification, spoken guidance, optional voice commands, Q&A, local progress, and labeled evaluation tools. The dedicated coach keeps its JSON-based lesson library; all nine complete illustrated lessons and automatic camera coaching are also available at `/learn`.

## Run

Use Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `/coach` on the local URL printed by Next.js. Camera access works on `localhost`; phones require HTTPS. Models and fonts are served from the app itself. `prepare:vision` copies the lockfile-pinned MediaPipe runtime into `public/mediapipe/wasm` before dev/build. Official hand and pose model bundles are checked in under `public/mediapipe`.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Configuration

| Variable | Default / behavior |
| --- | --- |
| `OPENAI_API_KEY` | Server-only key. Missing key makes AI coaching unavailable. |
| `OPENAI_VISION_MODEL` | `gpt-6-luna`; use an image-capable Responses model enabled for your account. |
| `MOCK_VERIFIER` | `false`; an explicit local/test-only simulation, ignored in production. |

Both coaching interfaces use the OpenAI Responses integration and structured output. Requests disable response storage. Availability depends on the configured API account. Provider failures offer retry or an explicitly unverified continuation.

**Local mock mode assesses no images.** Production never substitutes simulation for a missing provider key. The interface displays a mock badge; simulated passes are stored as `simulated`, never `verified`. Evaluation excludes mock records by default. Watch-only sessions use `walkthrough` outcomes and never start the camera or call verification.

## Demo flow

1. Choose the tie lesson, review the equipment, and answer the intake questions.
2. Choose camera coaching or the watch-only walkthrough.
3. For camera coaching, read and accept consent. Position the phone at chest height, about an arm’s length away. Setup advances after the required framing/light checks hold for 1.5 seconds.
4. Follow the instruction. Tap **I’m done with this step**, say **done**, or move for at least two seconds and then hold both hands still for 1.5 seconds.
5. The app checks local visibility, captures three unmirrored cropped JPEG frames over 600 ms, and asks the verifier. A correction gives one action; uncertain strict checks offer two retries and then demo/manual continuation. Light-step uncertainty advances as unverified. Three confident failures also expose manual continuation.
6. Ask a short question, replay slowly, go back, or stop at any time. Tab hiding pauses the camera processing and cancels in-flight work; resuming is explicit.
7. Completion lists outcomes/retries. **Progress** shows completed sessions, most revisited steps, and last practice. **Settings** provides privacy details and deletion of local data.

Voice recognition is opt-in and browser-dependent. English commands: next, repeat, back, show me, done, help. Dutch: volgende, herhaal, terug, laat zien, klaar, help. Questions starting with how/why/what/which or Dutch equivalents go to Q&A. Recognition uses the browser locale; spoken coaching and content are English. Buttons remain available throughout.

## Vercel and HTTPS phone testing

Import `thomasdevving/plsteachme` into Vercel, select the Next.js preset and the repository root, and leave the standard build settings. Add the environment variables to the desired deployment environment. Authenticated AI practice uses the shared Supabase account and one-session trial. See `AUTH_SETUP.md`; illustrated practice at `/learn` works without credentials. JSON and SVG assets are explicitly included in server function tracing.

Open the deployment’s HTTPS URL on a phone and allow camera access. Prefer a Vercel preview deployment for evaluation. Alternatively, expose your local server through a trusted HTTPS tunnel, for example `cloudflared tunnel --url http://localhost:3000`, and open the printed HTTPS URL. A LAN `http://192.168…` address does not provide a secure camera context. Vercel deployment and physical-phone performance require separate verification.

The manifest and network-only service worker support installation. Use **Add to Home Screen** on Safari or the browser’s install menu where available. Offline operation is not implemented; the service worker never caches frames or API responses.

## Add a skill — JSON plus assets

1. Create `skills/your-skill-id.json`. Filename and `id` must match. Copy the tie lesson for a complete example, or `shaving.json` for a coming-soon stub.
2. Provide title, description, version, estimated minutes, difficulty, equipment, intake questions, camera setup and completion tips. Available skills need steps; coming-soon skills need an empty `steps` array.
3. Give each step a unique ID, title, instruction, spoken instruction, demo asset, `checkStrictness`, local prechecks, rubric and `maxAttempts`.
4. Put optional illustrations under `public/skills/your-skill-id/`. Reference them as `/skills/your-skill-id/step.svg`. Paths cannot escape `/skills/`. `catalog.previewAsset` and `catalog.outline` can describe a future module.
5. Use `strict` for observable important endpoints, `light` for visually ambiguous intermediate moves and `none` for unchecked steps. Rubric criteria must be visible; do not demand an unseen action. Common error IDs must be unique. Keep corrective cues within 15 words.
6. Use the learner’s own right/left. The preview is mirrored; sent frames and diagrams are unmirrored, so the learner’s right appears on the image’s left.
7. Choose local prechecks from `bothShouldersVisible`, `neckRegionVisible`, `bothHandsVisible`, `handsInChestRegion`, `enoughLight`. Current framing primitives target upper-body skills; a skill needing a different anatomical region needs additional landmark/ROI code.
8. Run `npm run validate:skills`, `npm test`, and `npm run build`. Discovery, route generation, intake and the coach require no skill registry changes.

### Camera position per lesson and step

`cameraSetup` drives the setup guide, visible checklist, camera selection and verification crop. Set `framing` to `upper-body`, `neck`, `face`, `tabletop` or `feet`, `facingMode` to `user` or `environment`, a concrete `instruction`, `requiredLandmarks`, and `minLuminance`. A step may provide its own complete `cameraSetup`; the coach pauses for fresh positioning when this changes. The final tie step uses a closer collar-and-knot view without requiring hands to remain visible. **Adjust camera position** repeats positioning without resetting the lesson.

For a tabletop skill, use `framing: "tabletop"`, `facingMode: "environment"`, and hand requirements only. Do not add shoulder or nose prechecks to its steps. Face views can require only `nose`; shoe views can require hands and optional `leftFoot`/`rightFoot`. Hand requirements specify one working hand or two visible hands; they do not infer which anatomical hand is present. Upper-body and neck views crop using shoulders/nose; face views use face landmarks; tabletop/shoe views keep the full frame to avoid cutting out objects. These are positioning checks, not object detection. Lesson authors must define appropriate rubric/prechecks; only the tie lesson is currently available.

`lib/skills/schema.ts` validates skills at build/load time. Shared interface copy lives in `lib/copy/en.ts`; lesson-specific language lives in JSON.

## Evaluation

Open `/coach/session/tie-four-in-hand?debug=1` and choose camera coaching. The debug panel shows landmarks, the ROI, local checks, state, in-memory frame thumbnails, raw validated model output and client/server latency.

After each check, select **Verdict was correct** or **Verdict was wrong**. For incorrect verdicts, select the ground truth and error ID, then save the label. Labels remain available while the next step is practiced, including the final result on completion. Evaluation uses the server-configured OpenAI model. Manual overrides are recorded in session outcomes and on the latest eval record when present.

Open `/coach/eval` to inspect per-step totals, labeled accuracy, false pass rate, false fail rate, uncertain rate and p50/p95 round-trip latency. Filter by model and optionally include simulations. JSON/CSV exports reflect the active filters.

- Accuracy uses labeled records; failure accuracy also compares the labeled error ID where provided.
- False pass rate = predicted passes on human-labeled failures / all human-labeled failures.
- False fail rate = predicted failures on human-labeled passes / all human-labeled passes.
- Undefined denominators display a dash, not a misleading zero.
- Frame saving is **off by default**. Explicitly enabling it stores those captured images locally and includes them in JSON exports. CSV contains no images.

Use a real key, multiple ties, different lighting/phone positions, and deliberately incomplete knots. Label false passes carefully. Mock results and synthetic tests are not evidence of knot-recognition accuracy.

## Architecture and privacy

- `lib/session`: explicit reducer, confidence decisions and configurable thresholds. No landmark result is treated as proof that the knot is correct.
- `lib/vision`: lazy hand/pose models, pure prechecks, central-person selection, ROI and three-frame capture. Downscaled 480px inference targets 15 fps and yields/lower rates on slow devices.
- `app/api/verify-step`: bounded same-origin JSON input, server-owned rubrics, image-message API, one retry for malformed output, Zod validation, seven-second provider budget inside an eight-second client deadline.
- `app/api/ask`: text-only, bounded question/answer, current skill context.
- `lib/speech`: interruptible speech output and command parsing.
- `lib/storage`: IndexedDB drafts, completion records and optional evaluation logs. A sessionStorage fallback retains walkthrough drafts when available.

Live video stays on-device. Cropped stills are sent only for step checks; this app does not persist them on the server or log image data. The AI provider processes them under its own API policies. Server logs contain only timing, verdict, confidence and error ID. Optional browser speech recognition may send audio to its provider, as disclosed in consent. There are no accounts, app analytics or trackers.

## Validation and known limits

Unit/component tests cover reducer paths, confidence thresholds, visibility/stillness/ROI, API validation, invalid provider JSON, Q&A bounds, evaluation metrics, and a full seven-step coaching loop with controlled camera inputs. Browser tests cover 375×812, 414×896 and desktop, including the walkthrough, consent, denied-camera fallback, actual MediaPipe loading against a synthetic camera stream, eval export/deletion, and mock API responses.

```sh
# Start a production server first. Use its port below.
TEST_BASE_URL=http://localhost:3000 npm run test:browser -- --workers=2
# Optional: point TEST_BROWSER_PATH at an installed Chrome executable.
# Otherwise: npx playwright install chromium
```

Real-camera accuracy, sustained mid-range Android performance, and a physical-phone HTTPS session remain unverified. Automated tests use isolated mocks and do not validate real knot-recognition accuracy. Intermediate wrap steps are inherently ambiguous in still images. MediaPipe inference currently runs synchronously with throttling/yielding; slower phones may run below 15 fps. Occlusions, loose clothing, multiple people and very long ties can reduce visibility; the ROI and confidence thresholds need real-device evaluation. Browser speech and camera support vary, with button and watch-only fallbacks. Storage can be denied or evicted by the browser. The app reports failed completion/eval writes; memory-only practice can continue.

For a deterministic active-camera UI check, run `npm run test:camera-fixture` in a separate terminal, then `npm run test:camera-flow`. The fixture runs on port 3013 and renders the actual coaching components with controlled landmarks, a synthetic browser camera, and intercepted, explicitly simulated verdicts. It checks three-frame JPEG capture, a correction/retry and all seven steps at each viewport. It is test-only and has no Next.js route. Set `TEST_BROWSER_PATH` if needed. The normal browser suite separately loads the real MediaPipe models.

For positioning-guide regression screenshots, keep the camera fixture running and use `FRAMING_ONLY=1 node tests/capture-framing.mjs`. This exercises all five guide profiles at phone and desktop widths without contacting OpenAI.
