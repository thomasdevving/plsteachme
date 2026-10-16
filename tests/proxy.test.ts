import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../proxy";

describe("public mascot assets", () => {
  it.each([
    "/mascots/companions-atlas.webp",
    "/mascots/companions-atlas.png",
    "/mascots/seated-atlas.webp",
    "/mascots/seated-atlas.png",
  ])("serves %s without a locale rewrite", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      false,
    );
  });

  it("still routes the landing page through the English layout", () => {
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/" }),
    ).toBe(true);
  });
});
