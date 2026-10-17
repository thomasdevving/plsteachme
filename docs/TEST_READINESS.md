# Connected test run

The learner, camera, community and teacher flows are implemented. Use this checklist after connecting OpenAI and Supabase. Subscriptions remain unchanged. These checks prepare a private test; they do not certify model accuracy or public-launch readiness.

## Configure once

1. Apply **all four** files in `supabase/migrations/` in filename order to the intended Supabase project. The final migration creates the private `teacher-demonstrations` bucket.
2. Set the server variables in `.env.example`: Supabase URL, public/anon key, service-role key, OpenAI key and the actual site origin. `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are supported consistently. A service-role or secret key must never be put in a public variable. Browser uploads only use signed destinations.
3. Enable Supabase Email authentication and registrations, configure production email delivery, and allow the site's `/auth/callback` and `/auth/confirm` URLs. Use `https://plsteachme.vercel.app` for this deployment. Google/Apple are optional; leave their flags false until configured.
4. Create a separate reviewer account, confirm its email, and put its Auth user UUID in `PLATFORM_REVIEWER_IDS`. A teacher cannot approve their own application or publish their own lesson. Use a fresh learner account for the one-session trial.
5. Configure access to `OPENAI_VISION_MODEL` and `OPENAI_TRANSCRIPTION_MODEL`, then redeploy after changing environment variables. The teacher bucket and project upload limit must support the intended recording size (the app allows up to 100 MB).

## Run the setup check

From the repository, with Node 24 and the locked dependencies installed:

```sh
npm run verify:setup
npm run verify:setup -- --url https://plsteachme.vercel.app
```

This loads the same production environment files as Next.js, including `.env.local`, without printing their contents. If credentials are only in Vercel, run in an environment where the same variables are securely available; the script does not download secrets. The optional URL checks the deployment's public availability endpoints without sending it any server credentials.

The script checks required credentials, zero-row reads of all application tables, denied anonymous table access, trial/platform function discovery, private storage settings, confirmed reviewer accounts and configured OpenAI model access. Every network operation is read-only and bounded. It makes **no database changes, uploads, email requests or AI inference calls**, and exits nonzero on a failed check. A model-access check does not prove inference billing/quota or output quality. SMTP, allowed redirects and device permissions still require the browser run below.

## Browser acceptance run

| Flow | Expected result |
| --- | --- |
| Account | Request a sign-up link, open it in the same browser, land back on the requested page, sign out and sign in again. Expired links remain recoverable. |
| Learner trial | Start one lesson, reload and resume it. A second tab cannot claim a different free lesson. Finish it and confirm another session is unavailable. Use fresh test accounts rather than resetting real entitlements. |
| Camera | Consent before access; automatic feedback with no manual capture button; Pause stops uploads; Stop, navigation and hidden tabs release camera tracks. Denied permission leaves written practice usable. |
| AI quality | Try clear, obscured and incorrect examples. Uncertain or nonvisual evidence must not auto-pass. Check step questions and optional automatic advancement. Test on an actual phone as well as desktop. |
| Community | Submit a request, support it, remove support, reload and confirm persistence. A temporary service failure should preserve entered text and allow retry. |
| Teacher | Apply, have the independent reviewer approve, record or upload a short video, preview, transcribe, edit the AI proposal, save and submit. Optional training permission remains off unless explicitly selected. |
| Review/publication | The reviewer watches the recording, adds notes and publishes. The reviewed version appears in `/learn`; later draft edits do not change it. Withdrawal removes new public access. |
| Recovery | Interrupt the network during a save, then reconnect and retry. Never treat a timeout as proof the server did not commit; reload before repeating non-idempotent actions. |

Real browser actions in this acceptance run create test records and may consume OpenAI credits. The automated test suites instead use isolated databases and mocked external services; MediaPipe browser checks use real local models with a simulated camera.

## Automated checks

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:browser
```

Both browser suites start the built app on port 3100 if needed. To target an existing local test server, set `TEST_BASE_URL=http://localhost:3100`. The additional coach/device suite covers 375px, 414px and desktop views, including real MediaPipe model loading on simulated media. Run the write-capable automated suites against an isolated local test environment, not production.

## Boundaries for a wider launch

Detailed learning progress is browser-local. Feedback reports support human review, not automatic model retraining. Rate limits are currently per process; shared limits/provider spending controls and finalized privacy, retention and deletion procedures remain wider-launch work. These do not require changing the existing subscription presentation.

Reference: [OpenAI model metadata](https://developers.openai.com/api/reference/resources/models/methods/retrieve), [Supabase bucket inspection](https://supabase.com/docs/reference/javascript/storage-getbucket).
