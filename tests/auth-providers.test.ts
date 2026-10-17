import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({
  authConfig: () => ({ enabled: true, url: "https://project.supabase.co", key: "public-key" }),
}));
import { authProviders } from "../lib/auth/providers";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTH_GOOGLE_ENABLED", "");
  vi.stubEnv("AUTH_APPLE_ENABLED", "");
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("uses the actual configured providers without a second deployment flag", async () => {
  fetchMock.mockResolvedValue(Response.json({ external: { google: true, apple: false } }));
  expect(await authProviders()).toEqual({ google: true, apple: false });
});
it("does not enable an unconfigured provider through a local flag", async () => {
  vi.stubEnv("AUTH_GOOGLE_ENABLED", "true");
  fetchMock.mockResolvedValue(Response.json({ external: { google: false, apple: false } }));
  expect(await authProviders()).toEqual({ google: false, apple: false });
});
it("respects an explicit operator disable", async () => {
  vi.stubEnv("AUTH_GOOGLE_ENABLED", "false");
  fetchMock.mockResolvedValue(Response.json({ external: { google: true, apple: true } }));
  expect(await authProviders()).toEqual({ google: false, apple: true });
});
it.each([null, { external: { google: "true", apple: 1 } }, {}])("fails closed for malformed settings: %j", async value => {
  fetchMock.mockResolvedValue(Response.json(value));
  expect(await authProviders()).toEqual({ google: false, apple: false });
});
it("leaves email available when provider discovery is unavailable", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  expect(await authProviders()).toEqual({ google: false, apple: false });
});
