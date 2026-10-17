import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/lora/400.css";
import "../../app/coach/coach.css";
import { LiveCoach } from "../../components/live-coach";
import { Header } from "../../components/header";
import { createSession } from "../../lib/session/machine";
import { availableSkillSchema } from "../../lib/skills/schema";
import definition from "../../skills/tie-four-in-hand.json";
const skill = availableSkillSchema.parse(definition);
const profile = new URLSearchParams(location.search).get("framing");
if (
  profile &&
  ["upper-body", "neck", "face", "tabletop", "feet"].includes(profile)
) {
  skill.cameraSetup.framing = profile as typeof skill.cameraSetup.framing;
  skill.cameraSetup.requiredLandmarks =
    profile === "face"
      ? ["nose"]
      : profile === "neck"
        ? ["nose", "leftShoulder", "rightShoulder"]
        : profile === "tabletop" || profile === "feet"
          ? ["leftHand", "rightHand"]
          : skill.cameraSetup.requiredLandmarks;
  skill.cameraSetup.instruction = {
    "upper-body": skill.cameraSetup.instruction,
    neck: "Move closer. Keep your collar and knot inside the guide.",
    face: "Set the camera at eye level and fit your face inside the guide.",
    tabletop: "Point the camera down at the whole work area and both hands.",
    feet: "Point the camera down at your shoes, laces and hands.",
  }[profile]!;
}
const graphics: Record<string, string> = await (
  await fetch("/__test_graphics")
).json();
// The actual production UI, with only landmark inference replaced in Vite config.
createRoot(document.getElementById("root")!).render(
  <>
    <Header backHref="/" backLabel="Leave lesson" />
    <LiveCoach
      skill={skill}
      initial={createSession({}, "live")}
      graphics={graphics}
      debug={false}
      onExit={() => {}}
    />
  </>,
);
