# Specialized computer vision models (MVP)

plsteach.me's camera coaching uses a general AI vision model in the cloud. This MVP adds the first specialized models: small per-lesson models trained on contributed demonstrations, which recognize each step's correct result and its common mistake directly from hand and body landmarks, on the learner's device.

## How it works

1. **Collect** (`/vision`). A contributor picks a lesson and a label, then records 4-second clips from the camera or marks segments in a local video. Each lesson has these labels:
   - `other`: in between steps, setting up
   - `s<n>`: step *n* done right
   - `m<n>`: step *n*'s common mistake (from the lesson's first listed mistake)

   MediaPipe hand and pose tracking runs in the browser. Each frame becomes a 103-number feature vector (`lib/vision/features.ts`): hand shapes relative to the wrist and hand size, hand positions relative to the shoulders, and elbows and wrists. That makes it independent of where the person stands and how close they are. **Only these numbers are uploaded and stored: no images, video or audio.** Clips where hands are visible in fewer than half the frames are rejected, except for `other`.
2. **Train** (`lib/vision/model.ts`, server-side, about a second). The model is a one-hidden-layer neural network (32 ReLU units, softmax), trained with class-balanced cross-entropy, Adam and L2. Mirrored copies of every frame make it work with both front and back cameras. Training is seeded, so the same data always gives the same model. It is pure TypeScript, has no dependencies, and is about 20 KB of weights.
3. **Evaluate honestly.** Whole clips are held out per label (about 25%, at least one), because frames from the same recording are nearly identical and a frame-level split would overstate accuracy. The report shows macro F1, clip and frame accuracy, per-label precision and recall, and a confusion matrix. The deployed model is then retrained on every clip.
4. **Quality gate.** A model can be activated only if the held-out results reach macro F1 ≥ 80%, clip accuracy ≥ 80%, and recall ≥ 60% for every label, each label having at least one held-out clip. The database enforces this (`vision_activate`) along with a single active model per lesson.
5. **Shadow deployment.** For any built-in or published lesson with an active model, the camera coach downloads it and runs it on the device at about 7 frames per second. Predictions are smoothed over time, and it abstains below 60% confidence. It shows what it recognizes (step result, a likely mistake, or "not sure"), **but never confirms or advances a step**. Each cloud-coach verdict scores the on-device prediction for the same step. A `looks_right` verdict agrees when the model saw that step's result; an `adjust` verdict agrees when it saw a mistake or another state. Unclear and non-visual verdicts are not scored. The lab shows each model's agreement rate. Only the model ID, step, predicted label, confidence and cloud verdict are sent, and only inside a consented coaching session.

## Who can contribute

- **Built-in lessons**: vision lab staff, meaning platform reviewers (`PLATFORM_REVIEWER_IDS`) and verified emails in `VISION_LAB_EMAILS`. When that variable is unset, the owner account is used; set it empty to restrict the lab to reviewers.
- **Teacher lessons**: the lesson's own teacher, but only after granting the existing, separate "considered for future model training" permission in the teacher studio, plus staff. Every clip records a consent version and its contributor; contributors can delete their clips, and staff can delete any.
- **Activation and retirement**: staff only. Staff can also export a lesson's landmark dataset as JSON for training larger models offline.

## Setup

Run `supabase/migrations/20261020090000_vision_models.sql`. It adds `vision_clips`, `vision_models` and `vision_shadow_checks` (RLS on, service role only) and the `vision_activate` function. No new services or keys are needed. Without the migration, the lab reports that it cannot load, and coaching continues without an on-device model.

## Limits and next steps

- Per-frame landmarks capture hand and arm configuration, not objects. Steps whose result is a property of the fabric, razor or food rather than the hands (for example "the knot is centered") need object-aware models. The exported datasets and the shadow agreement data are the inputs for that next stage, for example fine-tuning an image model on teacher videos.
- Models are only as varied as their clips: record several people, both hands, different lighting and camera angles.
- Training runs inside the API request and caps work at 6,000 frames (400 clips per lesson). Larger datasets should train offline from the export.
- Promotion beyond shadow mode (for example, the on-device model triggering an earlier cloud check, or confirming steps when both agree) should wait until a model shows sustained high agreement on real learners.
