# Learning environment

The marketing website remains at `/`. `/learn` and `/account` use the learning
navigation instead: learning home and the signed-in user's username (falling
back to their name or “My account”). Profile saves refresh that label. The
marketing header also shows the account name instead of “Log in” when signed in.
Ordinary login and signup return to `/learn` unless a safe destination was
explicitly requested. Password recovery still returns to account settings.

Lessons have their own routes without a marketing header, catalog or footer:

- `/learn/tie`, `/learn/shaving`, etc.: the nine illustrated lessons.
- `/learn/lessons/<id>`: a published teacher lesson, fetched through the existing
  publication/access checks.
- `/training/modules/<id>`: organization training, using the existing membership
  and version checks. Navigating directly does not grant access.

Old `/learn?skill=...` and `/learn?lesson=...` links redirect to those pages.
Catalog cards, journeys, resume links, homepage lesson links and the demo
library navigate to them directly. Progress keys and trial identifiers remain
unchanged, so existing saved progress and free-session entitlements are kept.

The current instruction, illustration/checkpoint and Back/Next controls occupy
the lesson viewport. Prepare, Coach and Progress switch views instead of adding
sections below it. Choosing a checkpoint opens that step; completing practice
returns to its completion summary. Optional lengthy explanations, teacher
content and enlarged text can scroll inside their view so content stays
accessible; navigation remains visible. Nothing is clipped to force a fit.

Switching away from the camera view stops tracks, cancels pending capture and
automatic advancement, and requires an explicit restart. Switching away from
questions stops read-aloud. Camera consent, privacy details, reports, manual
checks and unresolved checkpoints remain available. Illustrations work without
an account; AI still requires the existing trial or organization authorization.

The Supabase confirmation-email design is separate from this frontend deploy.
See [email activation](../supabase/templates/README.md).
