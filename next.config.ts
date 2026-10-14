import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./skills/**/*.json", "./public/skills/**/*.svg"],
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
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
    ];
  },
};
export default config;
