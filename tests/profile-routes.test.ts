import { beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  row: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ authenticatedUser: mocks.user }));
vi.mock("@/lib/ai-guard", () => ({ sharedRateAllowed: async () => true }));
vi.mock("@/lib/storage", () => ({
  db: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: (...args: unknown[]) => {
          mocks.eq(...args);
          return chain;
        },
        maybeSingle: mocks.row,
        upsert: mocks.upsert,
        update: (...args: unknown[]) => {
          mocks.update(...args);
          return chain;
        },
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return chain;
    },
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        download: mocks.download,
      }),
    },
  }),
}));
import { GET, PATCH } from "../app/api/profile/route";
import {
  GET as avatar,
  POST as upload,
  DELETE as remove,
} from "../app/api/profile/avatar/route";
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  username: "ada_l",
  first_name: "Ada",
  last_name: "Lovelace",
  has_avatar: true,
  updated_at: "2026-10-27T12:00:00Z",
};
const request = (body: unknown, origin = "https://plsteach.me") =>
  new Request("https://plsteach.me/api/profile", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id });
  mocks.row.mockResolvedValue({ data: row, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
});
it("returns private details only for the verified account", async () => {
  const response = await GET();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    profile: {
      username: "ada_l",
      firstName: "Ada",
      lastName: "Lovelace",
      hasAvatar: true,
      updatedAt: row.updated_at,
    },
  });
  expect(mocks.eq).toHaveBeenCalledWith("user_id", id);
  mocks.user.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  mocks.user.mockResolvedValue({ id, is_anonymous: true });
  expect((await GET()).status).toBe(401);
});
it("saves only validated names and normalized usernames for the session owner", async () => {
  expect(
    (
      await PATCH(
        request({
          username: "ADA_L",
          firstName: " Ada ",
          lastName: " Lovelace ",
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: id,
      username: "ada_l",
      first_name: "Ada",
      last_name: "Lovelace",
    }),
    { onConflict: "user_id" },
  );
  mocks.upsert.mockClear();
  expect(
    (
      await PATCH(
        request({
          username: "ada_l",
          firstName: "Ada",
          lastName: "Lovelace",
          user_id: "victim",
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(
    (
      await PATCH(
        request(
          { username: "ada_l", firstName: "Ada", lastName: "Lovelace" },
          "https://evil.test",
        ),
      )
    ).status,
  ).toBe(403);
});
it("reports a username collision without overwriting another account", async () => {
  mocks.upsert.mockResolvedValue({ error: { code: "23505" } });
  expect(
    (
      await PATCH(
        request({ username: "taken", firstName: "Ada", lastName: "Lovelace" }),
      )
    ).status,
  ).toBe(409);
});
it("bounds photo uploads and strips metadata before private storage", async () => {
  const frame = await readFile(
    new URL("./fixtures/exif-frame.jpg", import.meta.url),
  );
  const response = await upload(
    new Request("https://plsteach.me/api/profile/avatar?user_id=victim", {
      method: "POST",
      headers: { origin: "https://plsteach.me", "content-type": "image/jpeg" },
      body: frame,
    }),
  );
  expect(response.status).toBe(200);
  const [path, bytes, options] = mocks.upload.mock.calls[0];
  expect(path).toBe(`${id}/avatar.jpg`);
  expect(Buffer.from(bytes).includes(Buffer.from("Exif"))).toBe(false);
  expect(options).toMatchObject({ contentType: "image/jpeg", upsert: true });
  expect(mocks.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: id, has_avatar: true }),
    { onConflict: "user_id" },
  );
});
it("rejects SVG, corrupt JPEGs and oversized bodies before writing storage", async () => {
  for (const [type, body, status] of [
    ["image/svg+xml", "<svg/>", 400],
    ["image/jpeg", "not a jpeg", 400],
    ["image/jpeg", new Uint8Array(262145), 413],
  ] as const) {
    expect(
      (
        await upload(
          new Request("https://plsteach.me/api/profile/avatar", {
            method: "POST",
            headers: { origin: "https://plsteach.me", "content-type": type },
            body,
          }),
        )
      ).status,
    ).toBe(status);
  }
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("rejects unauthenticated photo changes and serves only the current account photo", async () => {
  mocks.user.mockResolvedValue(null);
  expect(
    (
      await remove(
        new Request("https://plsteach.me/api/profile/avatar", {
          method: "DELETE",
          headers: { origin: "https://plsteach.me" },
        }),
      )
    ).status,
  ).toBe(401);
  expect(mocks.remove).not.toHaveBeenCalled();
  mocks.user.mockResolvedValue({ id });
  mocks.download.mockResolvedValue({ data: new Blob(["photo"]), error: null });
  const response = await avatar();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.download).toHaveBeenCalledWith(`${id}/avatar.jpg`);
  expect(
    (
      await remove(
        new Request("https://plsteach.me/api/profile/avatar", {
          method: "DELETE",
          headers: { origin: "https://plsteach.me" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.remove).toHaveBeenCalledWith([`${id}/avatar.jpg`]);
});
