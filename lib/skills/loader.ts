import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { skillSchema, type Skill } from "./schema";

// Server/build use only. Discovery makes new skills a JSON-and-assets change.
export function loadSkills(
  directory = path.join(process.cwd(), "skills"),
): Skill[] {
  const skills = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const skill = skillSchema.parse(
        JSON.parse(readFileSync(path.join(directory, file), "utf8")),
      );
      if (file !== `${skill.id}.json`)
        throw new Error(`Skill filename must match its id: ${file}`);
      for (const step of skill.steps) {
        if (
          step.demoAsset.includes("..") ||
          !existsSync(path.join(process.cwd(), "public", step.demoAsset))
        )
          throw new Error(`Missing or invalid demo asset: ${step.demoAsset}`);
      }
      return skill;
    });
  if (new Set(skills.map((skill) => skill.id)).size !== skills.length)
    throw new Error("Duplicate skill IDs.");
  return skills.sort(
    (a, b) =>
      Number(b.status === "available") - Number(a.status === "available"),
  );
}
export function getSkill(id: string): Skill | undefined {
  return loadSkills().find((skill) => skill.id === id);
}
