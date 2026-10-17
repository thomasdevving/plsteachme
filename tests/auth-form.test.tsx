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
import { renderToString } from "react-dom/server";
import { PasswordForm } from "../components/password-form";
const fetchMock = vi.fn();
it.each(["signup", "password"])(
  "protects %s fields before hydration",
  (mode) => {
    const markup = renderToString(
      mode === "signup" ? (
        <AuthForm enabled signup />
      ) : (
        <PasswordForm enabled update />
      ),
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    expect(document.querySelector("form")?.getAttribute("method")).toBe("post");
    expect(
      Array.from(document.querySelectorAll("input")).every(
        (input) => input.disabled,
      ),
    ).toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
  },
);
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value },
  });
const submit = (label = "Email address") =>
  fireEvent.submit(
    screen.getByLabelText(label, { exact: true }).closest("form")!,
  );
it("offers email/password only and disables unavailable forms", () => {
  render(<AuthForm enabled={false} signup />);
  expect(
    (screen.getByLabelText("Email address") as HTMLInputElement).disabled,
  ).toBe(true);
  expect(
    screen
      .getAllByRole("button")
      .every((b) => (b as HTMLButtonElement).disabled),
  ).toBe(true);
  expect(screen.queryByText(/Google|Apple|coming soon/)).toBeNull();
});
it("submits a password registration, clears passwords, and focuses confirmation", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  render(<AuthForm enabled signup next="/coach" />);
  fill("Email address", "person@example.com");
  fill("New password", "twelve words here");
  fill("Confirm password", "twelve words here");
  submit();
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Check your inbox." }),
    ).toBeTruthy(),
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    action: "signup",
    email: "person@example.com",
    password: "twelve words here",
    next: "/coach",
  });
  await waitFor(() => expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Check your inbox." }),
  ));
  expect(
    (screen.getByRole("button", { name: /Resend in/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Use a different email" }),
  );
  expect(
    (screen.getByLabelText("New password", { exact: true }) as HTMLInputElement)
      .value,
  ).toBe("");
});
it("rejects mismatched signup passwords before making a request", () => {
  render(<AuthForm enabled signup />);
  fill("Email address", "person@example.com");
  fill("New password", "twelve words here");
  fill("Confirm password", "different words here");
  submit();
  expect(screen.getByRole("alert").textContent).toContain("do not match");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("offers password recovery and supports password managers and visibility", () => {
  render(<AuthForm enabled />);
  const field = screen.getByLabelText("Password", {
    exact: true,
  }) as HTMLInputElement;
  expect(field.autocomplete).toBe("current-password");
  expect(field.type).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(field.type).toBe("text");
  expect(
    screen
      .getByRole("link", { name: "Forgot your password?" })
      .getAttribute("href"),
  ).toBe("/forgot-password");
});
it("offers resend after an unconfirmed login without resending the password", async () => {
  fetchMock
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: "Confirm your email",
        code: "email_not_confirmed",
      }),
    })
    .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  render(<AuthForm enabled />);
  fill("Email address", "person@example.com");
  fill("Password", "twelve words here");
  submit();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Resend confirmation email" }),
    ).toBeTruthy(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Resend confirmation email" }),
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    action: "resend-confirmation",
    email: "person@example.com",
  });
});
it("preserves email and re-enables login after a network error", async () => {
  fetchMock.mockRejectedValue(new Error("Connection lost. Please try again."));
  render(<AuthForm enabled />);
  fill("Email address", "person@example.com");
  fill("Password", "twelve words here");
  submit();
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Connection lost"),
  );
  expect(
    (screen.getByLabelText("Email address") as HTMLInputElement).value,
  ).toBe("person@example.com");
  expect(
    (screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("requests recovery with a generic account-existence response", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  render(<PasswordForm enabled />);
  fill("Email address", "person@example.com");
  submit();
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Check your inbox." }),
    ).toBeTruthy(),
  );
  expect(screen.getByText(/If this email belongs to an account/)).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    action: "reset-password",
    email: "person@example.com",
  });
});
it("updates passwords without sending an email or user identity", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  render(<PasswordForm enabled update />);
  fill("New password", "twelve words here");
  fill("Confirm password", "twelve words here");
  submit("New password");
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Password saved." }),
    ).toBeTruthy(),
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    action: "update-password",
    password: "twelve words here",
  });
  expect(screen.queryByLabelText("New password")).toBeNull();
});
it("does not show success when recovery delivery fails", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({ error: "Account services unavailable" }),
  });
  render(<PasswordForm enabled />);
  fill("Email address", "person@example.com");
  submit();
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("unavailable"),
  );
  expect(
    screen.queryByRole("heading", { name: "Check your inbox." }),
  ).toBeNull();
});
