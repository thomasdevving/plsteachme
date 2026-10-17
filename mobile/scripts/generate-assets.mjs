import { copyFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const assets = fileURLToPath(new URL("../.assets/", import.meta.url));
await mkdir(assets, { recursive: true });
try {
  await copyFile(
    new URL("../../public/brand/hands-filled.png", import.meta.url),
    `${assets}/logo.png`,
  );
  const result = spawnSync(
    "npx",
    [
      "--no-install",
      "capacitor-assets",
      "generate",
      "--ios",
      "--android",
      "--assetPath",
      ".assets",
      "--iconBackgroundColor",
      "#faf7f2",
      "--iconBackgroundColorDark",
      "#faf7f2",
      "--splashBackgroundColor",
      "#faf7f2",
      "--splashBackgroundColorDark",
      "#faf7f2",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(assets, { recursive: true, force: true });
}
