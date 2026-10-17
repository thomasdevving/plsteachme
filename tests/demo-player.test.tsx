// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { DemoPlayer } from "../components/demo-player";

vi.mock("../components/tie-motion", () => ({
  TieMotion: () => <svg aria-label="Tie preview" />,
}));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));
let notifyVisibility: (visible: boolean) => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notifyVisibility = (visible) =>
          callback(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("requires Play, advances the placeholder, and pauses when scrolling away", () => {
  const { rerender } = render(<DemoPlayer src="" active={false} />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  rerender(<DemoPlayer src="" active />);
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByText("One tie. Seven little steps.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play demo preview" }));
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByText("Cross it over the narrow end.")).toBeTruthy();
  rerender(<DemoPlayer src="" active={false} />);
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.getByText("Cross it over the narrow end.")).toBeTruthy();
});

it("pauses when offscreen and can replay the finished preview", () => {
  render(<DemoPlayer src="" />);
  fireEvent.click(screen.getByRole("button", { name: "Play demo preview" }));
  act(() => notifyVisibility(false));
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByText("Start with the wide end longer.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play demo preview" }));
  act(() => vi.advanceTimersByTime(18000));
  expect(screen.getByText("Slide the knot up gently.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Replay demo preview" }));
  expect(screen.getByText("Start with the wide end longer.")).toBeTruthy();
});

it("shows a recoverable error if the future video cannot play", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
    new Error("unavailable"),
  );
  render(<DemoPlayer src="/demo.mp4" />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Play demo video" })),
  );
  expect(screen.getByRole("status").textContent).toContain("could not load");
  expect(screen.getByRole("button", { name: "Play demo video" })).toBeTruthy();
});
