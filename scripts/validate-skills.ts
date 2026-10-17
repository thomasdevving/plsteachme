import { loadSkills } from "../lib/skills/loader";
const skills = loadSkills();
console.info(`Validated ${skills.length} skills and their demo assets.`);
