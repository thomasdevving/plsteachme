# Voice coaching with Bolna

Hands-free coaching in the main lesson player at `/learn`. The learner turns voice on, talks with a Bolna voice agent, and can ask questions, interrupt, go back, move on or pause while their hands are busy. plsteach.me stays responsible for lesson content, camera assessments and progress. Bolna handles the conversation and the speech.

The tie lesson is the first lesson validated end to end with automated tests. The integration is shared: every built-in lesson gets the same voice coach through `LessonPlayer`, with its context resolved on the server from the same lesson data.

## How it fits together

```
Browser (/learn)                        plsteach.me server                       Bolna
LessonPlayer ── VoiceCoach ── POST /api/voice/session ── reserve minutes ──────▶ POST /web-call/session
     │            │ (BolnaWebCall,          │ bind execution (run_id)      ◀──── run_id + SIP credentials
     │            │  getSession)            │
     │            ◀──── WebRTC audio ───────┼────────────────────────────────────▶ voice agent
     │            │ poll /api/voice/session/{id} ◀── command queue ◀── tools ◀─── POST /api/voice/tools/*
     │            │ ack /…/ack (once)        │
CameraCoach ── POST /api/coaching/check ──── server verdict ── voice_observe ──▶ POST /v1/call/{run_id}/events
                                             │                                      (Graph Agent only)
                                             ◀───────────── execution webhook ──── POST /api/voice/webhook
                                             GET /executions/{id} (trusted usage) ▶
```

- **Session coordination** (`supabase/migrations/20261023090000_voice_coaching.sql`): one `voice_sessions` row per call holds the opaque session ID, the learner, the lesson and content version, the Bolna execution ID from the server-side mint, the current step, a monotonically increasing revision, the latest server-validated camera assessment and its time, the status and the reserved and used seconds. Every change happens in one database function under a row lock.
- **Lesson context** (`lib/voice/lesson.ts`) is resolved on the server through `resolveLessonHelp`, the same resolver the typed questions use. The browser sends only a skill and step; prompts, agent IDs and camera verdicts from the browser are never accepted.
- **Tools** (`app/api/voice/tools/[tool]/route.ts`): `get_current_step`, `get_latest_observation`, `request_lesson_action` (next, back, replay, pause, resume, stop) and `request_camera_check`. A tool only works on the session whose tool token it carries.
- **Command queue**: the agent's lesson actions become commands for the current revision, unique per action and revision, so a retried tool call returns the same command. The browser polls every 1.5 seconds, applies a command only if its revision and step still match the screen, and acknowledges it once. Every applied command and every manual navigation advances the revision, so older commands go stale.
- **Camera results**: `/api/coaching/check` records the feedback it just produced on the learner's voice session, only for the session's current lesson and step and only while coaching is active. In Graph mode a new, significant result (high-confidence `looks_right` or `adjust`, or `stop`) is published once per step and result as a `camera_result` event. `unclear` and `not_verifiable` stay on screen; the coach can fetch them when asked. An accepted event does not prove it was spoken: Bolna waits for current speech to finish.

## Lesson correctness

- A spoken "next" uses `advanceLessonProgress`, the same rule as the Next button: it records `self_checked` unless the camera already confirmed the visible checkpoint. It can never create `camera_confirmed`; only a server camera result can.
- While voice coaching is on, the camera's timed auto-advance is off, so the screen cannot move while the coach is talking about an earlier step.
- Navigation, restart, pause and lesson changes advance the revision and clear the stored observation. Observations older than 45 seconds, for another step, or from before a navigation are not given to the agent. The agent is told to call `get_current_step` before step-specific advice and to describe camera results as "the latest camera check", one still snapshot, never live video.
- A spoken or on-screen pause pauses automatic camera checks too (`CameraCoach holdChecks`), and the server stops recording observations and refuses lesson actions other than resume and stop until coaching resumes. The existing immediate on-screen handling of `stop` camera feedback is unchanged.

## Browser behavior

- The microphone is allowed only on `/learn` (Permissions-Policy in `next.config.ts`); other lesson routes keep `microphone=()`.
- The SDK (`@bolna/web-call` 3.0.1, MIT) is imported in the browser only, after availability is confirmed and before the click, so `start()` still runs inside the click. Microphone permission is requested before any minutes are reserved.
- One voice call per tab, claimed on the first click; the server also allows only one open session per account (`busy` while another tab is polling).
- Starting voice cancels browser speech synthesis, and "Read answer aloud" is hidden while voice is on. The separate `/coach` experience keeps its own browser speech and is not combined with Bolna.
- The call stops and the server session ends on Stop, on Reset lesson progress (the coaching panels restart, as the camera already does), on page hide, on navigation or unmount (the SDK also hangs up on `pagehide`), on sign-out (both sign-out paths navigate), when the lesson is completed and when the call reaches its time limit.
- Visible controls: status (connecting, listening, coach speaking, paused), Mute, Pause or Resume, and Stop voice. Lesson buttons keep working whether or not voice is available.
- Plain-English messages cover microphone denial, capacity limits (`at_capacity`), connection failure, blocked audio playback, an exhausted allowance, the daily limit, a session already running elsewhere and missing configuration.

## Access, privacy and cost

- Starting voice requires the signed-in account's open free coaching session for this lesson (`trialAccess`, the same check the camera and questions use). Built-in lessons only for now; published and organization lessons keep their own access paths and are not offered voice yet.
- **Voice minutes are separate from AI request counts.** Each start reserves the full maximum call length (`VOICE_MAX_CALL_SECONDS`, default 300) against the account's allowance (`VOICE_ALLOWANCE_MINUTES`, default 15) and the service-wide daily cap (`VOICE_DAILY_MINUTE_LIMIT`, default 240). A start is refused if the whole reservation does not fit, so a call can never run past the allowance. Bolna enforces the maximum call length through the agent's `call_terminate`; the browser and the server also end the session then.
- After the call, the execution webhook triggers a read of `GET /executions/{id}` with the server key. Its duration, not the webhook body, replaces the reservation, once. A reservation that is never reconciled stays counted. A call that never connected (mint failure) is refunded.
- Bolna does not sign tool calls or webhooks. Its documented trust mechanisms are its fixed source IPs and the headers configured on the agent. Tools require the agent's `Authorization: Bearer BOLNA_TOOL_SECRET` and the per-session tool token; webhooks require `BOLNA_WEBHOOK_SECRET`; both can require Bolna's source IPs (`BOLNA_SOURCE_IPS`). Webhook deliveries are deduplicated by execution, status and time; reconciliation is once-only anyway.
- The session tool token travels in Bolna `user_data`, which Bolna keeps with the call record. It is scoped to one session and stops working when the session ends or expires.
- **What is stored here:** session and accounting fields, the current step, and the latest camera assessment text until the session ends. No audio, recordings or transcripts. **At Bolna:** Bolna processes calls in the US (AWS us-east-1 by default) and keeps recordings and transcripts in the execution record; its docs say to contact support for the retention policy. The privacy copy says exactly this. Confirm the account's recording and retention settings with Bolna before making any stronger claim.
- Prices and plans are unchanged. Nothing promises unlimited voice.

## Configuration

Server-only variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `BOLNA_API_KEY` | Bolna `bn-` key. Never sent to the browser. |
| `BOLNA_AGENT_ID` | The voice coaching agent. |
| `BOLNA_TOOL_SECRET` | 24+ random characters; the tools' Bearer token. |
| `BOLNA_WEBHOOK_SECRET` | 24+ random characters; the webhook's `x-plsteach-webhook-secret` header. |
| `BOLNA_AGENT_MODE` | `graph` (default) publishes camera and step events; `tools` relies on the coach fetching results. |
| `BOLNA_SOURCE_IPS` | Bolna's documented source IPs; empty skips the IP check. |
| `BOLNA_API_BASE`, `BOLNA_WEB_CALL_SESSION_PATH` | Optional overrides. The mint path defaults to `/web-call/session` (current docs) and falls back to `/web-call/freeswitch-session` (the SDK repository's example) on 404. |
| `VOICE_MAX_CALL_SECONDS` | Must equal the agent's Total Call Timeout. 60 to 1800, default 300. |
| `VOICE_ALLOWANCE_MINUTES`, `VOICE_DAILY_MINUTE_LIMIT` | Per-account and service-wide voice minutes. |

Missing or too-short values make `/api/voice/session` report `available: false`; the lesson shows that voice coaching is not connected and everything else keeps working. Supabase storage and sign-in are also required.

Apply the migration with the others (`supabase db push` or the SQL editor).

## Bolna agent setup

The agent is versioned as code in `lib/voice/agent-config.ts`; `bolna/agent.graph.example.json` and `bolna/agent.tools.example.json` are rendered from it with placeholder secrets (`npm run bolna:agent -- --examples`).

1. Generate the two secrets, for example `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, and set the variables above plus `NEXT_PUBLIC_SITE_URL` to the public HTTPS address Bolna can reach.
2. Create the Graph Agent: `node --env-file=.env.local --import tsx scripts/bolna-agent.ts --create`. It prints the new `agent_id`; set `BOLNA_AGENT_ID`. Later changes: `--update <agent_id>`. `--print` shows the payload without sending it.
3. In the dashboard, open the agent's Extractions tab. The script sets the webhook URL with `?key=` because the agent API has no header field; for a cleaner setup, remove `?key=…` from the URL, turn on **Add headers** and add `x-plsteach-webhook-secret: <BOLNA_WEBHOOK_SECRET>`. Leave statuses at all (only terminal ones are used).
4. Check that the agent uses Bolna's bundled providers (OpenAI `gpt-4.1-mini`, Deepgram `nova-3`, ElevenLabs `eleven_turbo_v2_5`, as in Bolna's own minimal example) without asking for separate Deepgram or Cartesia accounts, that Total Call Timeout equals `VOICE_MAX_CALL_SECONDS`, and that Hangup on User Silence is 90 seconds.
5. If the account cannot use Graph Agents with web calls, create the fallback with `--mode tools` and set `BOLNA_AGENT_MODE=tools`. The coach then fetches the latest camera check when the learner asks instead of being told.

**Dashboard finding (21 October 2026):** the Graph Agent editor at platform.bolna.ai offers only LLM, Expression and Unconditional transitions, and its JSON import drops `condition_type: "event"` and `event_name`, turning event edges into LLM edges with empty conditions. The agent created through the dashboard (`eb266dcf-172e-42c0-ace5-39278b3516bb`) therefore uses one `coach` node with the four tools and no event nodes; run the app with `BOLNA_AGENT_MODE=tools`. Event edges may still be accepted through `PUT /v2/agent/{agent_id}` (`npm run bolna:agent -- --update <agent_id>`), but saving the agent again in the dashboard editor could drop them. That has not been tested.

The graph has three nodes. `coach` (start) answers with the tools. `camera_update` speaks a fresh `camera_result`. `step_intro` introduces the screen's new step after a `step_changed` event (sent after a spoken or manual move). Both event edges are on every node; the two event nodes return to `coach` on the learner's next turn.

## Verification status

Automated, with a controlled substitute for Bolna's HTTP API and the real SQL in PGlite (`tests/voice-db.test.ts`, `tests/voice-routes.test.ts`), and a fake Web Call SDK in jsdom (`tests/voice-coach.test.tsx`):

- unauthorized starts, another learner's session and token, tool secret and source IP checks
- stale revisions, steps and observations; observations from another lesson or while paused
- duplicate tool calls, duplicate acknowledgements and repeated webhook deliveries
- spoken next recording only a self-check; manual navigation making pending commands stale
- spoken and on-screen pause and stop; hidden page, navigation and completion stopping the call
- missing configuration, mint failures, capacity limits, failed connections and microphone denial
- voice-minute reservation, refunds, the daily cap, reconciliation from the execution record and the maximum call duration

**Not yet verified live.** No Bolna credentials were available while building this, so no real call, tool callback, event injection or webhook has run. Still to do with an account:

1. Create the agent (step 2 above) and confirm the mint path and session shape.
2. Confirm that `{{voice_session}}` and `{{voice_token}}` from `user_data` are substituted into the Graph Agent's tool parameters (documented for custom functions; verify for graph tools).
3. Confirm that Graph Agents accept web calls in this account and that `POST /v1/call/{run_id}/events` reaches a web call. If not, switch to `--mode tools`.
4. A bounded smoke test on `/learn` (tie lesson): start voice, ask "Which end goes behind?", interrupt the answer, say "next", start the camera and get a camera-grounded correction, say "pause coaching" and confirm camera checks pause, then Stop voice. Check the execution's duration is reconciled.
5. On a real phone over HTTPS: camera and microphone at the same time, echo with the speaker, and the page-hide stop.

## Buildathon demo script (tie lesson, about 3 minutes)

Setup: signed in with an open free session, on `/learn`, tie lesson at step 1, camera coaching on with the tie shown and good front light, phone at chest height.

1. **Turn voice on.** Tick the two boxes under Voice coach, read out the one-line privacy summary, press Start voice coaching and allow the microphone. The coach greets you and introduces step 1.
2. **Ask a question.** "Which end goes behind?" The coach calls `get_current_step` and answers from the lesson: the wide end goes behind the narrow end in step 3, and for now the wide end should hang lower.
3. **Interrupt.** While it is explaining, say "Explain it more simply." It stops mid-sentence and gives a shorter version.
4. **Camera-grounded correction.** Hold the tie with the wide end too short. The automatic camera check returns `adjust`; the coach says what the latest camera check found and the guidance ("Lower the wide end until it hangs below the narrow end"). Point out that it says "latest camera check", not "I can see you".
5. **Fix and confirm.** Lower the wide end. The next check returns `looks_right`; the coach says the visible checkpoint looks right and you can say next. The screen shows "Camera-confirmed visible checkpoint". Nothing advanced on its own.
6. **Progress correctly.** Say "I'm ready for the next step." The screen moves to step 2 and the coach introduces it. Step 1 stays camera-confirmed; a step you move past by voice without a camera confirmation shows "Self-checked".
7. **Go back.** "Go back." The screen returns to step 1. Then "next" again.
8. **Pause.** "Pause coaching." The coach confirms once and goes quiet; the camera panel shows checks paused. "Resume coaching" brings both back.
9. **Stop.** Press Stop voice. The call ends, the microphone indicator goes off, and the lesson buttons still work.
