// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SessionCoach } from "../components/session-coach";
import { createSession, type SessionContext } from "../lib/session/machine";
import { getSkill } from "../lib/skills/loader";
import type { AvailableSkill } from "../lib/skills/schema";
vi.mock("../lib/session/draft", () => ({
  restoreDraft: async () => ({ ...createSession({}, "live"), stepIndex: 2 }),
  saveDraft: () => {},
}));
vi.mock("../lib/storage/store", () => ({
  readLocal: async () => true,
  writeLocal: async () => true,
  completeSession: async () => true,
}));
vi.mock("../components/live-coach", () => ({
  LiveCoach: ({
    initial,
    onExit,
  }: {
    initial: SessionContext;
    onExit: (c: SessionContext) => void;
  }) => (
    <button
      onClick={() =>
        onExit({
          ...initial,
          stepIndex: 3,
          records: [
            {
              stepId: "drape",
              attempts: 1,
              failures: 0,
              uncertaintyRetries: 0,
              outcome: "verified",
            },
          ],
        })
      }
    >
      Stop camera
    </button>
  ),
}));
it("keeps the current live step and outcomes when switching to watch-only", async () => {
  Object.assign(globalThis, { React });
  window.scrollTo = () => {};
  const skill = getSkill("tie-four-in-hand") as AvailableSkill;
  render(<SessionCoach skill={skill} debug graphics={{}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Stop camera" }));
  await screen.findByRole("heading", { name: "Cross over again" });
  expect(document.querySelector(".debug-panel pre")?.textContent).toContain(
    "verified",
  );
  expect(document.querySelector(".debug-panel pre")?.textContent).toContain(
    '"stepIndex": 3',
  );
  cleanup();
});
