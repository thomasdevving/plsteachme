// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AuthForm } from "../components/auth-form";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("honestly disables unconfigured providers and email", () => {
  render(<AuthForm enabled={false} google={false} apple={false} signup />);
  expect(
    (screen.getByLabelText("Email address") as HTMLInputElement).disabled,
  ).toBe(true);
  expect(
    screen
      .getAllByRole("button")
      .every((button) => (button as HTMLButtonElement).disabled),
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("temporarily unavailable");
});
it("submits email registration explicitly, then focuses the confirmation", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  render(
    <AuthForm
      enabled
      google
      apple
      signup
      next="/coach/session/tie-four-in-hand"
    />,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "person@example.com" },
  });
  for (const [label,value] of [['First name','Ada'],['Last name','Lovelace'],['Username','ada_l'],['Password','a long secret passphrase'],['Confirm password','a long secret passphrase']]) {
    fireEvent.change(screen.getByLabelText(label),{target:{value}});
  }
  // Signing up needs the age and terms confirmation first.
  fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: /16 or older/ }));
  fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Check your inbox." }),
    ).toBeTruthy(),
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    action: "signup",
    username: 'ada_l', firstName: 'Ada', lastName: 'Lovelace', acceptedTerms: true,
    password: 'a long secret passphrase',
    email: "person@example.com",
  });
  await waitFor(() => expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Check your inbox." }),
  ));
  expect(
    (screen.getByRole("button", { name: /Resend in/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it("announces connection errors without discarding the email", async () => {
  fetchMock.mockRejectedValue(new Error("Connection lost. Please try again."));
  render(<AuthForm enabled google apple />);
  fireEvent.change(screen.getByLabelText("Email or username"), {
    target: { value: "person@example.com" },
  });
  fireEvent.submit(screen.getByLabelText("Email or username").closest("form")!);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Connection lost"),
  );
  expect(
    (screen.getByLabelText("Email or username") as HTMLInputElement).value,
  ).toBe("person@example.com");
  expect(
    (
      screen.getByRole("button", {
        name: "Log in",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
