import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/lora/400.css";
import "../../app/globals.css";
import { LiveCoach } from "../../components/live-coach";
import { Header } from "../../components/header";
import { createSession } from "../../lib/session/machine";
import { availableSkillSchema } from "../../lib/skills/schema";
import definition from "../../skills/tie-four-in-hand.json";
const skill = availableSkillSchema.parse(definition);
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
