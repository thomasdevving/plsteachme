import bundled from '../../.generated/skills.json';
import { skillSchema, type AvailableSkill, type Skill } from './schema';

// Validated and bundled before dev/build/test; Workers have no project filesystem.
const skills: Skill[] = bundled.skills.map((skill) => skillSchema.parse(skill));
const graphics: Record<string, Record<string, string>> = bundled.graphics;
export function loadSkills(): Skill[] { return skills; }
export function getSkill(id: string): Skill | undefined { return skills.find((skill) => skill.id === id); }
export function loadSkillGraphics(skill: AvailableSkill): Record<string, string> { return graphics[skill.id] ?? {}; }
