import type { SkillId } from "./config";

export const builtinLessonHref = (skill: SkillId) => `/learn/${skill}`;
export const publishedLessonHref = (id: string) =>
  `/learn/lessons/${encodeURIComponent(id)}`;
export const trainingLessonHref = (id: string) =>
  `/training/modules/${encodeURIComponent(id)}`;
