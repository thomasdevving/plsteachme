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
import { Mascot, MascotMotionControl } from "../components/mascot";

let notifyVisibility: (visible: boolean) => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal("React", React);
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
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  disconnect.mockClear();
});

it.each(["sitting", "peeking"] as const)(
  "only animates visible %s characters in a visible document and cleans up",
  (pose) => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { container, unmount } = render(
      <Mascot pose={pose} color="orange" />,
    );
    const character = container.firstElementChild!;
    expect(character.getAttribute("aria-hidden")).toBe("true");
    expect(character.getAttribute("data-active")).toBe("false");
    act(() => notifyVisibility(true));
    expect(character.getAttribute("data-active")).toBe("true");
    hidden.mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(character.getAttribute("data-active")).toBe("false");
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(character.getAttribute("data-active")).toBe("true");
    act(() => notifyVisibility(false));
    expect(character.getAttribute("data-active")).toBe("false");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  },
);

it("can pause and resume all characters on a page without a hero demo", () => {
  const { unmount } = render(<MascotMotionControl />);
  fireEvent.click(
    screen.getByRole("button", { name: "Pause characters" }),
  );
  expect(document.documentElement.dataset.mascotsPaused).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "Resume characters" }),
  );
  expect(document.documentElement.dataset.mascotsPaused).toBe("false");
  unmount();
  expect(document.documentElement.dataset.mascotsPaused).toBeUndefined();
});
