import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  base: "./",
  publicDir: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("..", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
  // Shared lesson metadata reads these public website settings. No process
  // environment or server secrets are exposed to the native bundle.
  define: {
    "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(
      "https://plsteachme.vercel.app",
    ),
    "process.env.NEXT_PUBLIC_DEMO_APP_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_DEMO_VIDEO_URL": JSON.stringify(""),
  },
  server: { port: 3200, strictPort: true },
  preview: { port: 3200, strictPort: true },
});
