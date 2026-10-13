// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { LiveCoach } from "../components/live-coach";
import { createSession, type SessionContext } from "../lib/session/machine";
import { getSkill } from "../lib/skills/loader";
import type { AvailableSkill } from "../lib/skills/schema";
import { copy, liveCopy as c } from "../lib/copy/en";
const { save, write, capture } = vi.hoisted(() => ({
  save: vi.fn(
    async (
      _id: string,
      _skill: AvailableSkill,
      _context: SessionContext,
      _mock: boolean,
    ) => true,
  ),
  write: vi.fn(async () => true),
  capture: vi.fn(async () => ["/9j/AA==", "/9j/AA==", "/9j/AA=="]),
}));
vi.mock("../lib/speech/tts", () => ({
  speak: async () => {},
  stopSpeech: () => {},
}));
vi.mock("../lib/session/draft", () => ({ saveDraft: () => {} }));
vi.mock("../lib/storage/store", () => ({
  completeSession: save,
  writeLocal: write,
  labelEval: async () => true,
}));
vi.mock("../lib/vision/capture", () => ({ captureFrames: capture }));
vi.mock("../components/animated-diagram", () => ({
  AnimatedDiagram: () => null,
}));
vi.mock("../components/camera-view", () => ({
  CameraView: ({ onFrame }: { onFrame: (frame: unknown) => void }) => {
    const frame = (time: number, light = 100) => ({
      time,
      pose: Array.from({ length: 33 }, (_, i) => ({
        x: i === 11 ? 0.3 : i === 12 ? 0.7 : 0.5,
        y: i === 0 ? 0.2 : 0.4,
        visibility: 1,
      })),
      hands: [0.3, 0.7].map((x) =>
        Array.from({ length: 21 }, () => ({ x, y: 0.6 })),
      ),
      luminance: light,
      ambiguous: false,
    });
    return (
      <>
        <button
          onClick={() => {
            onFrame(frame(performance.now() - 1600));
            onFrame(frame(performance.now()));
          }}
        >
          Calibrate test camera
        </button>
        <button onClick={() => onFrame(frame(performance.now(), 10))}>
          Dark test frame
        </button>
      </>
    );
  },
}));
const skill = getSkill("tie-four-in-hand") as AvailableSkill;
const pass = {
  verdict: "pass",
  confidence: 0.9,
  errorId: null,
  observation: "Visible",
  feedback: "",
  latencyMs: 100,
  model: "test",
  mock: false,
};
let replies: unknown[], calls: unknown[];
beforeEach(() => {
  Object.assign(globalThis, { React });
  save.mockClear();
  write.mockClear();
  capture.mockClear();
  replies = [];
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/config")
        return { ok: true, json: async () => ({ mock: false }) };
      calls.push(JSON.parse(options?.body as string));
      return { ok: true, json: async () => replies.shift() ?? pass };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function start() {
  render(
    <LiveCoach
      skill={skill}
      initial={createSession({}, "live")}
      graphics={{}}
      debug={false}
      onExit={() => {}}
    />,
  );
  fireEvent.click(screen.getByText("Calibrate test camera"));
  await screen.findByRole("heading", { name: "Drape the tie" });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: copy.session.done })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
}
it("runs all seven steps through capture, verify, advance and durable completion", async () => {
  await start();
  for (const step of skill.steps) {
    await screen.findByRole("heading", { name: step.title });
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: copy.session.done })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.click(screen.getByText("Calibrate test camera"));
    fireEvent.click(screen.getByRole("button", { name: copy.session.done }));
  }
  await screen.findByRole("heading", { name: c.finished });
  expect(capture).toHaveBeenCalledTimes(7);
  expect(calls).toHaveLength(7);
  expect(save).toHaveBeenCalledTimes(1);
  expect(
    save.mock.calls[0][2].records.every(
      (r: { outcome: string }) => r.outcome === "verified",
    ),
  ).toBe(true);
});
it("blocks dark frames locally without calling the verifier", async () => {
  await start();
  fireEvent.click(screen.getByText("Dark test frame"));
  fireEvent.click(screen.getByRole("button", { name: copy.session.done }));
  await screen.findByText(c.dark);
  expect(calls).toHaveLength(0);
  expect(capture).not.toHaveBeenCalled();
});
it("offers manual continuation after three clear failures", async () => {
  replies = Array(3).fill({
    ...pass,
    verdict: "fail",
    errorId: "ends_equal",
    feedback: "Try again.",
  });
  await start();
  for (let i = 0; i < 3; i++) {
    fireEvent.click(screen.getByText("Calibrate test camera"));
    fireEvent.click(screen.getByRole("button", { name: copy.session.done }));
    await waitFor(() => expect(calls).toHaveLength(i + 1));
    if (i < 2)
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: copy.session.done })
            .hasAttribute("disabled"),
        ).toBe(false),
      );
  }
  fireEvent.click(screen.getByRole("button", { name: copy.session.override }));
  await screen.findByRole("heading", { name: "Cross over" });
  expect(calls).toHaveLength(3);
});

it("shows a recoverable message when a coach question times out", async () => {
  await start();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, options?: RequestInit) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Timeout", "AbortError")),
          ),
        ),
    ),
  );
  vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText(c.ask), {
    target: { value: "Which end is wide?" },
  });
  fireEvent.click(screen.getByRole("button", { name: c.askSend }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  vi.useRealTimers();
  expect(screen.getByText(c.askError)).toBeTruthy();
});
