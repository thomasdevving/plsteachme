import { createServer } from "vite";
import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
const root = process.cwd();
const server = await createServer({
  configFile: false,
  plugins: [
    {
      name: "fixture-graphics",
      configureServer(server) {
        server.middlewares.use("/__test_graphics", (_request, response) => {
          const directory = path.join(root, "public/skills/tie");
          response.setHeader("Content-Type", "application/json");
          response.end(
            JSON.stringify(
              Object.fromEntries(
                readdirSync(directory)
                  .filter((f) => f.endsWith(".svg"))
                  .map((f) => [
                    f.slice(0, -4),
                    readFileSync(path.join(directory, f), "utf8"),
                  ]),
              ),
            ),
          );
        });
      },
    },
  ],
  root,
  resolve: {
    alias: [
      {
        find: "next/image",
        replacement: path.join(root, "tests/fixtures/image.tsx"),
      },
      {
        find: "@/lib/vision/mediapipe",
        replacement: path.join(root, "tests/fixtures/landmarker.ts"),
      },
      {
        find: "next/link",
        replacement: path.join(root, "tests/fixtures/link.tsx"),
      },
      { find: "@", replacement: root },
    ],
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  server: {
    host: "127.0.0.1",
    port: 3013,
    strictPort: true,
    watch: {
      ignored: ["**/.next/**", "**/test-results/**", "**/.impeccable/**"],
    },
  },
});
await server.listen();
console.log(
  "Controlled-camera fixture: http://127.0.0.1:3013/tests/fixtures/index.html",
);
