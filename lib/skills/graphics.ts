import { readFileSync } from "node:fs";
import path from "node:path";
import type { AvailableSkill } from "./schema";

/** Inline only local, authored SVG assets so their drawing layers can animate. */
export function loadSkillGraphics(
  skill: AvailableSkill,
): Record<string, string> {
  const root = path.resolve(process.cwd(), "public/skills");
  return Object.fromEntries(
    skill.steps.flatMap((step) => {
      const asset = path.resolve(process.cwd(), "public", `.${step.demoAsset}`);
      if (!asset.startsWith(`${root}${path.sep}`) || !asset.endsWith(".svg"))
        return [];
      return [[step.id, readFileSync(asset, "utf8")]];
    }),
  );
}
