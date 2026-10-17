import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSkills } from "../lib/skills/loader";
import { skillSchema, type AvailableSkill } from "../lib/skills/schema";
const skills = loadSkills();
const tie = skills.find(
  (skill) => skill.status === "available",
) as AvailableSkill;
describe("skill definitions", () => {
  it("loads seven ordered tie steps with strict endpoints", () => {
    expect(tie.steps.map((step) => step.checkStrictness)).toEqual([
      "strict",
      "light",
      "light",
      "light",
      "light",
      "light",
      "strict",
    ]);
    expect(tie.steps.map((step) => step.id)).toEqual([
      "drape",
      "cross-over",
      "wrap-behind",
      "cross-again",
      "up-through-loop",
      "down-through-front",
      "tighten-adjust",
    ]);
  });
  it("keeps shaving unavailable with empty steps", () =>
    expect(skills.find((skill) => skill.id === "shaving")).toMatchObject({
      status: "coming_soon",
      steps: [],
    }));
  it("rejects available skills without steps", () =>
    expect(skillSchema.safeParse({ ...tie, steps: [] }).success).toBe(false));
  it("rejects duplicate step IDs", () =>
    expect(
      skillSchema.safeParse({ ...tie, steps: [tie.steps[0], tie.steps[0]] })
        .success,
    ).toBe(false));
  it("rejects duplicate intake IDs", () =>
    expect(
      skillSchema.safeParse({ ...tie, intake: [tie.intake[0], tie.intake[0]] })
        .success,
    ).toBe(false));
  it("rejects duplicate common error IDs", () => {
    const invalid = structuredClone(tie);
    invalid.steps[0].rubric.commonErrors.push(
      invalid.steps[0].rubric.commonErrors[0],
    );
    expect(skillSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects unknown local prechecks", () => {
    const invalid = {
      ...tie,
      steps: [{ ...tie.steps[0], localPrechecks: ["guessTieQuality"] }],
    };
    expect(skillSchema.safeParse(invalid).success).toBe(false);
  });
  it("keeps authored correction cues within fifteen words", () => {
    for (const step of tie.steps)
      for (const error of step.rubric.commonErrors)
        expect(error.cue.split(/\s+/).length).toBeLessThanOrEqual(15);
  });
  it("discovers new skills without a hard-coded import list", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lesson-"));
    try {
      writeFileSync(
        path.join(dir, "new-skill.json"),
        JSON.stringify({
          id: "new-skill",
          version: 1,
          title: "New skill",
          description: "Soon.",
          status: "coming_soon",
          steps: [],
        }),
      );
      expect(loadSkills(dir)[0].id).toBe("new-skill");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
  it("rejects missing assets at build/load time", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lesson-"));
    try {
      const invalid = structuredClone(tie);
      invalid.steps[0].demoAsset = "/skills/tie/missing.svg";
      writeFileSync(path.join(dir, `${tie.id}.json`), JSON.stringify(invalid));
      expect(() => loadSkills(dir)).toThrow("Missing or invalid demo asset");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
  it("requires filenames to match skill IDs", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lesson-"));
    try {
      writeFileSync(path.join(dir, "mismatch.json"), JSON.stringify(tie));
      expect(() => loadSkills(dir)).toThrow("filename must match");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
