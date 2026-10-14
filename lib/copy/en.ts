export const copy = {
  brand: "plsteach.me",
  mission: "Nobody should have to figure everything out alone.",
  motion: {
    preview: "One move at a time",
    choose: "Explore the seven moves",
    select: (index: number, title: string) => `Preview step ${index}: ${title}`,
    previous: "Previous preview step",
    next: "Next preview step",
    pause: "Pause lesson preview",
    play: "Play lesson preview",
  },
  home: {
    title: "A little help.\nA skill for life.",
    intro:
      "For the things nobody showed you. Take them one step at a time, at your own pace.",
    skills: "What would you like to learn?",
    available: "Ready when you are",
    soon: "Coming soon",
    start: "Learn this skill",
    continue: "Continue your lesson",
    footer: "No pressure. No judgment. Just a little practice.",
    tieAlt: "A four-in-hand tie knot, with the wide end highlighted.",
    walkthrough:
      "Practice with camera guidance, or follow a watch-only walkthrough.",
  },
  modules: {
    title: "What’s your next small skill?",
    intro:
      "Start with the tie lesson today. Explore the everyday skills we’re planning next.",
    browse: "Explore all modules",
    all: "All modules",
    ready: "Ready to practice",
    soon: "Coming soon",
    filters: "Filter modules by availability",
    view: "Explore module",
    plan: "The planned lesson",
    plannedNote:
      "This module is still being made. The outline below is a preview; a practice session isn’t available yet.",
    tryReady: "Practice the tie lesson",
    readyNote: "In the meantime, there’s one skill you can try today.",
  },
  how: {
    title: "Small steps. Real progress.",
    intro:
      "You don’t need to get it all at once. A lesson breaks one everyday skill into moves you can see, try, and repeat.",
    example: "A peek inside the lesson",
    stages: [
      {
        title: "See the move",
        body: "Start with a clear illustration and a short instruction. The wide end stays terracotta, so it’s easy to follow from one move to the next.",
        caption: "One thing to focus on.",
        detail: "Look at the picture. Read the move. There’s no rush.",
      },
      {
        title: "Give it a try",
        body: "Pick up your tie and practice the move. When you’re ready, tap “I’m done with this step” to continue. You set the pace.",
        caption: "Ready when you are.",
        detail:
          "Use the camera for step checks, or choose when to move on in the walkthrough.",
      },
      {
        title: "Make it familiar",
        body: "Need another look? Repeat an instruction, open the demonstration notes, or go back a step. Come back for another practice whenever you like.",
        caption: "Again is part of learning.",
        detail:
          "You can replay any move. There’s no penalty for needing another go.",
      },
    ],
    patientTitle: "You’re allowed to be new at this.",
    patientBody:
      "Some things seem obvious only because somebody showed us how. If nobody showed you, this is a place to start.",
    patientSecond:
      "No timer to beat. No score to chase. Just clear directions, a little practice, and room to figure it out.",
    try: "Try the tie lesson",
    futureTitle: "A coach that takes a second look.",
    futureIntro:
      "Choose camera coaching for spoken guidance and step checks, or learn with the illustrated walkthrough.",
    cameraTitle: "A second look, when you need it",
    cameraBody:
      "Camera coaching checks each step and offers one small correction at a time. Important steps need a confident check; ambiguous intermediate moves can be practiced without verification.",
    privacyTitle: "You stay in control",
    privacyBody:
      "Live video is processed on your device. After you give consent, a few cropped stills go to the AI service for each check. Watch-only mode keeps the camera off.",
    closingTitle: "Start with one small thing.",
    closingBody:
      "A tie, a few quiet minutes, and a little patience with yourself.",
  },
  common: {
    home: "Back to skills",
    back: "Back",
    minutes: "min",
    beginner: "Beginner",
    openMenu: "Lesson information",
  },
  intro: {
    title: "You can learn this.",
    learn: "What you’ll need",
    steps: "Here’s the path",
    start: "Let’s begin",
    note: "We’ll guide you through each move. Take as much time as you need.",
    mode: "Camera coaching or walkthrough",
    modeDetail:
      "Choose camera coaching or a watch-only walkthrough. You set the pace.",
    orientation: "Directions always mean your own right and left.",
  },
  intake: {
    title: "Let’s make this feel familiar.",
    description: "A couple of quick questions before we begin.",
    next: "Next question",
    start: "Start my lesson",
    choose: "Choose an answer to continue.",
    progress: (index: number, total: number) => `Question ${index} of ${total}`,
  },
  feedback: {
    pass: "Nice, that's right.",
    lightUncertain: "Looks like you're on track.",
    strictUncertain: "Hold still and show me once more, so I can check.",
    apiError: "I couldn't check that one. Want to try again or continue?",
  },
  session: {
    mode: "Walkthrough",
    modeDetail:
      "Your camera is off. Steps are recorded as practiced, not verified.",
    progress: (index: number, total: number) => `Step ${index} of ${total}`,
    done: "I’m done with this step",
    repeat: "Repeat",
    demo: "Show me again",
    closeDemo: "Hide demonstration notes",
    next: "Moving to the next step…",
    finish: "Finishing your walkthrough…",
    diagramNote: "Front view: your right is on the left of the drawing.",
    diagramLegend: "Terracotta shows the wide end.",
    demoNote:
      "Follow the terracotta wide end. Pause at any point and compare its position with your tie.",
    repeatNote: "Here’s that instruction again. Take your time.",
    exit: "Leave lesson",
    pause: "Your place is saved for this browser tab.",
    reading: "Read the instruction, then give it a try.",
    checking: "Looking…",
    retry: "Try this step again",
    replay: "Replay the demonstration",
    override: "I’m sure, continue",
    accepted: "This step was accepted without verification.",
    options: "Let’s take this at your pace.",
    debug: "Session state",
    stepSaved: "Step recorded as practiced.",
  },
  completion: {
    title: "One new thing\nyou’ve tried.",
    message:
      "You walked through every step. Come back whenever you’d like a little more practice.",
    disclaimer:
      "Walkthrough complete. Your knot hasn’t been checked by the camera or AI.",
    tips: "A few things to remember",
    summary: "Your practice",
    steps: (total: number) => `${total} steps practiced`,
    retries: "Steps you revisited",
    noRetries: "You moved through the lesson at your own pace.",
    again: "Practice again",
    manual: "Advanced without verification",
    verified: "Checked successfully",
    light: "Accepted without verification",
  },
  notFound: {
    title: "That lesson isn’t here.",
    detail: "Let’s find a skill you can practice.",
  },
};

export const liveCopy = {
  navMain: "Main",
  navProgress: "Progress",
  navSettings: "Settings",
  connecting: "Connecting…",
  preview: "Mirrored camera preview",
  rearPreview: "Rear camera preview",
  rearDetail: "Rear camera view. Images sent for checks have the same orientation.",
  adjustFraming: "Adjust camera position",
  frameAlt: (n: number) => `Captured frame ${n}`,
  readyCheck: "Ready",
  adjustCheck: "Adjust",
  chooseError: "Choose an error",
  other: "Other",
  loadingPractice: "Loading your practice…",
  loadingEval: "Loading evaluations…",
  completedCount: (n: number) =>
    `${n} completed ${n === 1 ? "session" : "sessions"}`,
  lastPracticed: "Last practiced",
  mostRevisited: "Most revisited",
  noRetries: "No retries recorded",
  sessionModes: (mock: number, watch: number) =>
    `${mock} simulated · ${watch} watch-only`,
  privacyStorage:
    "No analytics, accounts or trackers. Progress stays in this browser. Evaluation frames are saved locally only if you explicitly enable that option.",
  includeMock: "Include simulated results",
  allModels: "All models",
  labeledTotal: "Labeled / total",
  accuracy: "Accuracy",
  falsePass: "False pass rate",
  falseFail: "False fail rate",
  uncertain: "Uncertain",
  latency: "Latency p50 / p95",
  metricsNote:
    "False pass rate = passes on human-labeled failures / all human-labeled failures. False fail rate = failures on human-labeled passes / all human-labeled passes. Unlabeled checks are excluded from accuracy. Latency is client round trip.",
  resultsByStep: "Results by skill and step",
  step: "Step",
  total: "Total",
  labeled: "Labeled",
  falsePasses: "False passes",
  exportNote:
    "JSON exports include frames only for records captured with frame saving enabled.",
  startEval: "Start an eval session",
  timing: (client: number, server: number) =>
    `Round trip: ${Math.round(client)} ms · Server: ${server} ms`,
  checksCount: (checks: number, retries: number) =>
    `${checks} checks${retries > 0 ? ` · ${retries} retries` : ""}`,

  chooseTitle: "A little guidance, your way.",
  chooseDetail:
    "Practice with camera feedback, or follow the pictures at your own pace.",
  cameraStart: "Practice with camera",
  watch: "Watch-only walkthrough",
  mock: "Mock mode · simulated checks",
  live: "Camera coaching",
  privacyTitle: "Your camera. Your choice.",
  privacy:
    "Your live video is processed on this device for framing, light and movement. In live AI mode, when you finish a step, up to three cropped still frames go to our server and then to Anthropic to check the step. This app does not save those images on the server. Anthropic processes them under its API data policies. You can stop at any time.",
  privacyVoice:
    "Voice commands are optional. Your browser may send microphone audio to its speech recognition provider. You can use every feature with buttons instead.",
  age: "If you’re under 16, practice with a parent or guardian.",
  agree: "I understand and agree to the camera checks.",
  start: "Start camera",
  setupTitle: "Let’s find a good view.",
  modelsLoading: "Preparing the camera and on-device checks…",
  cameraError:
    "We couldn’t start the camera. Allow camera access in your browser’s site settings, then try again. On iPhone: Settings → Apps → Safari → Camera. On Android: Chrome → Site settings → Camera. You can also use the walkthrough.",
  modelError:
    "The camera checks couldn’t load. Check your connection and retry, or use the walkthrough.",
  retryCamera: "Try camera again",
  shoulders: "Shoulders visible",
  hands: "Both hands visible",
  neck: "Neck area visible",
  light: "Enough light",
  stable: "Hold this position for a moment.",
  alone: "Let’s keep just you in the middle of the frame.",
  dark: "Can you turn on a light?",
  frame: "Step back until your neck, shoulders and hands are visible.",
  stop: "Stop camera",
  paused: "Your lesson is paused.",
  resume: "Resume lesson",
  pause: "Pause",
  ready: "Take your time. Say “done” or tap when you’re ready.",
  looking: "Let me take a look.",
  reposition: "Adjust your position, then try again.",
  listen: "Enable voice commands",
  listening: "Microphone on",
  micOff: "Turn microphone off",
  micFailed: "Voice commands aren’t available. Use the buttons below.",
  ask: "Ask your coach",
  question: "What would you like to know?",
  askSend: "Ask",
  asking: "Thinking…",
  askError: "I couldn’t answer just now. Try again or replay the step.",
  unverified: "Some steps were practiced without verification.",
  finished: "You’ve finished your practice.",
  mockFinished:
    "This was a simulated session. Your knot has not been assessed.",
  checked:
    "The final knot passed the camera check. AI checks can make mistakes.",
  storageError:
    "Your browser couldn’t save this session. You can keep practicing, but progress may be lost.",
  progress: "Your practice",
  settings: "Privacy & settings",
  eval: "Evaluation",
  emptyProgress:
    "Your first practice is waiting. Completed lessons will appear here.",
  delete: "Delete my data",
  deleteConfirm:
    "Delete all saved practice, consent and evaluation records on this device?",
  deleted: "Your local data has been deleted.",
  deleteError:
    "Data could not be deleted. Try again or clear this site’s data in your browser settings.",
  evalTitle: "Check the checker.",
  evalIntro:
    "Label real camera results to understand where the coach needs work. Mock results are excluded from real accuracy.",
  correct: "Verdict was correct",
  wrong: "Verdict was wrong",
  truth: "What actually happened?",
  truthError: "Actual error",
  saveLabel: "Save label",
  savedLabel: "Label saved",
  saveFrames: "Save frames for eval",
  framesWarning:
    "Off by default. Enabling this stores camera images on this device and includes them in JSON exports. Only record people who agree.",
  exportJSON: "Export JSON",
  exportCSV: "Export CSV",
  emptyEval:
    "No checks recorded yet. Start a camera session with debug mode enabled.",
  model: "Verification model",
  slow: "Replay slowly",
  modeDetail:
    "The preview is mirrored. Images sent for checks are not mirrored.",
};
