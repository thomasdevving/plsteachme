import type { NextConfig } from "next";
import { execSync } from "node:child_process";
// One version per build, shared by the pages, /api/version and offline lesson
// packages. Stored in process.env so build workers that reload this file agree.
function appVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  let commit = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || "";
  if (!commit) try { commit = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* No git checkout. */ }
  const version = `${commit.slice(0, 8) || "local"}-${Date.now().toString(36)}`;
  process.env.NEXT_PUBLIC_APP_VERSION = version;
  return version;
}
const APP_VERSION = process.env.NODE_ENV === "development" ? "dev" : appVersion();
// Content security policy for production. Scripts stay same-origin (plus the optional
// analytics host and Cloudflare Turnstile); the site cannot be framed by other sites.
// Connections and media may use any HTTPS host: the Supabase project URL is runtime
// configuration, and uploads and playback use its signed storage URLs.
const origin = (value?: string) => { try { return value ? new URL(value).origin : ""; } catch { return ""; } };
const analytics = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "plausible" ? "https://plausible.io" : process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "umami" ? origin(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL) : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://challenges.cloudflare.com ${analytics}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const securityHeaders = process.env.NODE_ENV === "production" ? [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
] : [];
const config: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  outputFileTracingIncludes: {
    "/*": ["./skills/**/*.json", "./public/skills/**/*.svg"],
    // OpenNext bundles proxy dependencies as ESM; Node tracing only finds CJS.
    proxy: ["./node_modules/@opentelemetry/api/build/esm/**/*.js"],
  },
  async redirects() {
    return [
      {
        source: "/skills/:id",
        destination: "/coach/skills/:id",
        permanent: false,
      },
      {
        source: "/skills/:id/intake",
        destination: "/coach/skills/:id/intake",
        permanent: false,
      },
      {
        source: "/session/:id",
        destination: "/coach/session/:id",
        permanent: false,
      },
      ...["progress", "settings", "eval"].map((route) => ({
        source: `/${route}`,
        destination: `/coach/${route}`,
        permanent: false,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          ...securityHeaders,
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // The service worker must always be revalidated so fixes reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/coach/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
      ...["/teach", "/en/teach", "/nl/teach", "/training", "/en/training", "/nl/training"].map((source) => ({
        source,
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }],
      })),
    ];
  },
};
export default config;
