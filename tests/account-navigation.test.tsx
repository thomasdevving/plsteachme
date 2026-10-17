// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountNavigation } from "../components/account-navigation";
import type { Copy } from "../lib/i18n";
const fetchMock = vi.fn();
const copy = { how: "How it works", skills: "Skills", subscriptions: "Plans", org: "Organizations" } as Copy["nav"];
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows the same signed-in state on desktop and mobile and preserves it on a network failure", async () => {
  fetchMock.mockResolvedValue(Response.json({ user: { id: "test" } }));
  render(<AccountNavigation c={copy} home="/" page="home" />);
  await waitFor(() => expect(screen.getAllByRole("link", { name: "My account", hidden: true })).toHaveLength(2));
  expect(screen.queryByRole("link", { name: "Log in", hidden: true })).toBeNull();
  fetchMock.mockRejectedValue(new Error("offline"));
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(screen.getAllByRole("link", { name: "My account", hidden: true })).toHaveLength(2);
});
it("rechecks a restored page and reflects an actual sign-out", async () => {
  fetchMock.mockImplementation(async () => Response.json({ user: { id: "test" } }));
  render(<AccountNavigation c={copy} home="/" page="home" />);
  await waitFor(() => expect(screen.getAllByRole("link", { name: "My account", hidden: true })).toHaveLength(2));
  fetchMock.mockImplementation(async () => Response.json({ user: null }));
  fireEvent(window, new Event("pageshow"));
  await waitFor(() => expect(screen.getAllByRole("link", { name: "Log in", hidden: true })).toHaveLength(2));
});
it("does not claim the visitor is signed out while the account check is pending", () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  render(<AccountNavigation c={copy} home="/" page="home" />);
  expect(screen.queryByRole("link", { name: "Log in", hidden: true })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Account", hidden: true })).toHaveLength(2);
});
