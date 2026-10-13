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
      "This first version is a guided walkthrough. Camera coaching comes next.",
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
          "In this walkthrough, you choose when to move on. Your knot isn’t being checked yet.",
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
    futureTitle: "Next: a coach that can see the move.",
    futureIntro:
      "The guided walkthrough is ready today. We’re building camera coaching next, so the app can help you check a step as you practice.",
    cameraTitle: "A second look, when you need it",
    cameraBody:
      "The planned coach will use your phone camera to check each step and offer one small correction at a time. If it can’t see clearly or isn’t sure, it will ask for a better view instead of guessing.",
    privacyTitle: "You stay in control",
    privacyBody:
      "The current walkthrough uses no camera or AI service. Camera coaching is planned to process live video on your device and send only a few cropped stills for each check, after you give consent.",
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
    mode: "Button-only walkthrough",
    modeDetail:
      "No camera or AI checks in this version. You decide when to move on.",
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
