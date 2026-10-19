import type { SkillId } from '../config';

/** The main object each built-in lesson asks the learner to show the camera. */
export const builtinObjects: Record<SkillId, string> = {
  tie: 'tie', shaving: 'razor', beard: 'trimmer', ironing: 'iron', button: 'button',
  drill: 'drill', laundry: 'garment', cooking: 'couscous packet', bike: 'pump',
};

/** A short object name from a lesson's first listed material, e.g. "A clean dry towel" → "clean dry towel". */
export function objectFromMaterials(materials: string[]) {
  const first = (materials[0] || '').split(/,| and | or |\(/)[0].replace(/^(a|an|the|your|some)\s+/i, '').trim().toLowerCase();
  return first.slice(0, 40) || 'tool';
}
