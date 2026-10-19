# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
Next.js App Router, strict TypeScript, Tailwind, Zod, Supabase server SDK; Vercel target as explicitly requested.
## Users
Young people learning practical skills; supporters; schools, youth work and employers interested in pilots. Mobile social traffic first.
## Product Purpose
Help people learn practical skills through structured practice, evidence-aware AI coaching and human-reviewed teaching contributions. Collect skill demand and pilot interest alongside the learning product. Mission: Nobody should have to figure everything out alone.
## Capabilities and Constraints
Early demo/beta. First skill: tying a tie. Future skills must be labelled coming soon. No invented proof. English-only public site. Under-16 form stores no personal data, only an aggregate count. Missing Supabase uses an explicitly disclosed nonpersistent mock. Actual demo and video URLs, business details and founder bio await owner configuration.
## Brand Commitments
User confirmed plsteach.me. Warm paper, ink, terracotta; expressive serif, humanist sans. Inherit the existing demo's Lora and DM Sans visual world. Friendly inline line illustrations; no stock photos, robots or purple gradients.
## Product Principles
Be patient and clear. Demonstrate the mechanism honestly. Guidance complements parents and mentors. Avoid promises beyond the supplied camera-processing model.
## Accessibility & Inclusion
WCAG AA, keyboard navigation, visible focus, reduced motion, dark mode, 375px first.

## Current shipped surface
The user selected this landing website to replace the prior website on main. Public copy is English-only. Brand: supplied hands logo, green plsteach and orange .me. Hero text is user-pinned, with the second line orange. Nine modules offer honest text previews and interest voting; the phone is an interactive, explicitly illustrative coaching example. Waitlist and organization forms retain mock mode until services are configured.

## Complete illustrated modules — 17 October 2026

The user requested that the remaining modules work too. All nine skills now offer complete seven-step illustrated walkthroughs. This supersedes the earlier coming-soon/text-preview restriction for the local lessons. Camera coaching remains a future integration and is not claimed by any lesson. The hero, filtered library and `/demo` share the same lesson content. Each full lesson includes materials, instructions, checkpoints, tips, completion and restart. Lesson progress is transient client state; no account, camera or new storage is needed.

## Automatic camera coaching — 17 October 2026

The user requested built-in camera/AI coaching and explicitly required automatic checks. Full lessons now offer optional camera coaching with age confirmation, consent and browser permission. The hero remains an illustration. Active coaching sends reduced-size still-image pairs to OpenAI automatically, without a manual capture/check button. Learners control lesson advancement. Pause stops uploads; Stop, hidden pages, lesson switches and completion release the camera. The server validates requests and frames, uses server-owned lesson instructions, and normalizes uncertain or nonvisual checks. Missing configuration is visibly unavailable, with the illustrated lesson still working. This supersedes the previous future-integration statement. Camera content is not saved by this app; provider retention is disclosed. Live quality testing awaits the API key the user will configure after the build.

## Expanded product scope — 17 October 2026

The supplied Product Vision & Concept Overview adds a learner catalog, real-life journeys, community skill requests and a teacher studio. Existing subscriptions and pricing are expressly preserved; the proposed $9.99 credit/rollover model is not implemented.

Learners search six real-life categories, resume browser-local progress, ask step-specific questions and receive an honest checkpoint summary. A high-confidence visible match now records the checkpoint and advances after a four-second cancellable countdown, unless the learner opts out. This supersedes the previous manual-advancement-only behavior. Uncertain, nonvisual and hazardous checks remain unresolved until an appropriate self-check or clearer observation. Incorrect feedback can be sent for human review with separate text-only consent.

Accounts support requests and unique support votes. Teachers apply with experience and qualifications, record/upload a demonstration, optionally transcribe its audio and generate an editable structured draft from text and selected frames. Teacher approval precedes independent review. Published immutable versions power learner demonstrations and camera coaching. Changes require another review; teachers can withdraw publication. Submission/version checks prevent stale review decisions. Model training and payouts are not invented: optional training permission is recorded, reports require human review, and subscription/payment mechanics are unchanged. Setup and operating boundaries are documented in docs/PLATFORM.md.

## Frontend continuity
The current public frontend comes from codex/restore-coach: the rotating hero/demo phone, clay companions, horizontal module rail, account pages and Starter/Plus/Teams coming-soon subscription cards. The expanded learning, community and teacher scope is integrated into that frontend. All learner AI paths share the existing verified account and one-session trial; free illustrated lessons remain available. OpenAI serves the coaching interfaces, with no simulated success in production when its key is absent.

## Creative experience — 17 October 2026 (current)

The user granted creative freedom for layout and motion while retaining the product and subscription boundaries. The current homepage combines a larger editorial hero, clay companions and a dark demo stage with the established rotating phone. The demo remains an interactive illustration or configured video, with explicit playback controls.

MomentFinder turns three everyday situations into useful entry points: interview preparation, independent living and small repairs. Its accessible tabs show existing learning journeys and link directly to working lessons. `/learn` presents all nine illustrated skills through search, category filters, larger illustration cards, saved practice and related journeys. A selected lesson is brought into view, including when reached from a direct URL. Progress displays use actual browser-local records and keep camera-confirmed, self-checked and unresolved checkpoints distinct; finishing a walkthrough is not a claim of mastery.

The global animation preference persists in the browser and applies across the public site and coach. Reduced motion and pause controls support a calmer experience without removing lesson content or interaction. Account requirements, the existing one-session trial, teacher/community workflows and service-configuration boundaries are retained. Starter, Plus and Teams remain the existing coming-soon subscriptions with pricing to be announced; no new charge, credit, rollover or payment behavior is introduced. Earlier sections above are retained as product history.

The follow-up consolidates homepage discovery into the existing nine-skill section. Related skill journeys remain available inside `/learn`, avoiding two competing homepage entry points. Decorative slogans and side notes are removed; useful lesson counts, progress and instructions remain. Adding an OpenAI key alone does not activate coaching: production also requires configured Supabase authentication, migrated database/storage and the durable trial flow, followed by live integration validation. AI draft generation and feedback reports do not constitute an automatic model-training pipeline.

## Organization training — 19 October 2026 (current)

The user asked for the $100–$500/month organization capability, especially creating custom AI-guided modules: by the admin performing the skill so computer vision can track it, and by sending in a manual for AI to turn into a module. `/training` now provides private organization workspaces with admin, instructor and learner roles; seat-based plans ($100 for 25, $200 for 75, $350 for 150, $500 for 300 learners) enforced in the database, with billing explicitly not active; personal, hashed, email-bound invitation links; modules built from on-device hand-tracked demonstrations (key moments captured when the hands pause), PDF or text manuals, or written steps, with editable AI drafts; admin publication of immutable versions to everyone or selected learners; learner practice with instructor reference stills compared by the camera coach; and progress reports in which only the server records camera confirmations. Details and boundaries are in docs/ORGANIZATIONS.md. Earlier sections remain as history.

## Specialized vision models — 20 October 2026 (current)

The user's product description plans specialized computer vision models trained on teacher-contributed demonstrations, and asked for a working MVP. `/vision` lets staff (built-in lessons) and consenting teachers (their own lessons, via the existing optional training permission) record labelled clips (step done right, common mistake, in between) as on-device MediaPipe landmarks only. The server trains a small per-lesson neural network, evaluates it on held-out whole clips, and enforces a quality gate before staff can activate it. Active models run on learners' devices in shadow mode during camera coaching: they display what they recognize, are scored against the cloud coach's verdicts, and never confirm or advance steps. Details and limits are in docs/VISION_MODELS.md.
