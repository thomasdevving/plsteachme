import 'server-only';
import { skillIds, type SkillId } from '../config';
import { catalogEntries } from '../learning-catalog';
import { LESSON_CONTENT_VERSION } from '../learning-progress';
import { resolveLessonHelp } from '../lesson-help-context';
import type { CoachFeedback } from '../coaching-contract';
import { en } from '@/messages/en';

// Lesson context for the voice agent, resolved on the server from the same reviewed
// content as the illustrated lesson and the typed question helper. Built-in lessons
// first; published lessons can be added here through resolveLessonHelp's other branch.
export const voiceLessonKey = (skill: SkillId) => `builtin:${skill}`;
export function skillFromLessonKey(key: string): SkillId | null {
  const skill = key.startsWith('builtin:') ? key.slice(8) : '';
  return (skillIds as readonly string[]).includes(skill) ? skill as SkillId : null;
}

export async function voiceStepContext(skill: SkillId, step: number) {
  const { lesson } = await resolveLessonHelp({ skill, step });
  const { current, checkpoint } = 'checkpoint' in lesson ? lesson : { current: undefined, checkpoint: undefined };
  if (!current || !checkpoint) throw new Error('Built-in lesson step expected');
  return {
    lesson_title: en.skills.names[skill],
    content_version: LESSON_CONTENT_VERSION,
    step_number: step + 1,
    title: current.title,
    instruction: current.instruction,
    tip: current.tip,
    checkpoint: current.check,
    camera_can_confirm: checkpoint.visuallyCheckable,
    visible_evidence: checkpoint.observableEvidence[0] ?? null,
    common_mistake: checkpoint.commonMistakes[0] ?? null,
    manual_alternative: checkpoint.manualAlternative,
    safety: catalogEntries[skill].safety,
  };
}

/** Values for the agent's welcome message and prompt variables. Public lesson text only. */
export async function voiceUserData(skill: SkillId, step: number, stepCount: number) {
  const context = await voiceStepContext(skill, step);
  return { lesson_title: context.lesson_title, step_count: stepCount, step_number: context.step_number, step_title: context.title, step_instruction: context.instruction };
}

/** Event properties for a new step, merged into the call's context by Bolna. */
export async function stepChangedProperties(skill: SkillId, step: number) {
  const context = await voiceStepContext(skill, step);
  return { step_number: context.step_number, step_title: context.title, step_instruction: context.instruction, step_checkpoint: context.checkpoint };
}

const ANNOUNCED: readonly CoachFeedback['status'][] = ['looks_right', 'adjust', 'stop'];
/**
 * Which camera results are worth saying out loud, keyed by step and result, so the same
 * result is not repeated every check cycle. 'unclear' and 'not_verifiable' stay on screen;
 * the coach can still fetch them when asked.
 */
export function cameraEventKey(step: number, feedback: CoachFeedback): string | null {
  if (!ANNOUNCED.includes(feedback.status)) return null;
  if (feedback.status !== 'stop' && feedback.confidence !== 'high') return null;
  return `${step}:${feedback.status}`;
}
export function cameraEventProperties(step: number, feedback: CoachFeedback) {
  return { camera_step_number: step + 1, camera_result: feedback.status, camera_observation: feedback.observation, camera_guidance: feedback.guidance };
}
