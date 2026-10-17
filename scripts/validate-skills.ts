import { loadSkills } from "../lib/skills/loader";
import { loadSkillGraphics } from '../lib/skills/graphics';
import { mkdirSync, writeFileSync } from 'node:fs';
const skills = loadSkills();
const graphics = Object.fromEntries(skills.filter(skill => skill.status === 'available').map(skill => [skill.id, loadSkillGraphics(skill)]));
mkdirSync('.generated', { recursive: true });
writeFileSync('.generated/skills.json', JSON.stringify({ skills, graphics }));
console.info(`Validated ${skills.length} skills and their demo assets.`);
