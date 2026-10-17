import { z } from 'zod';
import { skillIds } from './config';
import { getCheckpoint } from './learning-catalog';

export const CHECK_INTERVAL_MS = 6000;
export const MAX_FRAME_BYTES = 200_000;
export const MAX_COACH_BODY_BYTES = 560_000;
export const feedbackSchema = z.object({
  status: z.enum(['looks_right', 'adjust', 'unclear', 'not_verifiable', 'stop']),
  confidence: z.enum(['high', 'medium', 'low']),
  observation: z.string().trim().min(1).max(350),
  guidance: z.string().trim().min(1).max(350)
});
export type CoachFeedback = z.infer<typeof feedbackSchema>;
export const coachRequestSchema = z.object({
  skill: z.enum(skillIds),
  step: z.number().int().min(0).max(6),
  frames: z.array(z.string().max(270_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)).min(1).max(2)
}).strict();
export const coachConsentSchema = z.object({ consent: z.literal(true), over16: z.literal(true) }).strict();

// These are framing hints, not alternate lesson instructions.
export const framingHints: Record<typeof skillIds[number], string> = {
  tie: 'Frame your collar and both tie ends. Use a front view with good light.',
  shaving: 'Frame the shaving tools or the area you are working on. Keep the razor still for a clear view.',
  beard: 'Frame the beard and guarded trimmer. Keep the guard and edges visible.',
  ironing: 'Frame the shirt section and iron, with your hands clear of the hot soleplate.',
  button: 'Bring the fabric and button close enough to see the holes and thread.',
  drill: 'Frame the clamped scrap wood and drill. Stop the drill before showing details.',
  laundry: 'Frame the care label, machine controls or clothes for the current step.',
  cooking: 'Frame the ingredients or bowl. Keep the phone away from hot water and knives.',
  bike: 'Frame the bike part for this step while the bike is stationary.'
};

// An image can show some results, but cannot certify motion, temperature,
// pressure, hidden fasteners, hygiene, material compatibility or safety.
export function visuallyCheckable(skill: typeof skillIds[number], step: number) {
  return getCheckpoint(skill,step).visuallyCheckable;
}

export function conservativeFeedback(feedback: CoachFeedback, skill: typeof skillIds[number], step: number): CoachFeedback {
  if (feedback.status === 'stop') return feedback;
  if (!visuallyCheckable(skill, step)) return {
    status: 'not_verifiable', confidence: 'low',
    observation: 'Camera images cannot confirm every part of this step.',
    guidance: 'Use the written checkpoint and the tool or product instructions. Ask someone experienced if you are unsure.'
  };
  if (feedback.confidence !== 'high' && ['looks_right','adjust'].includes(feedback.status)) return {
    status: 'unclear', confidence: feedback.confidence,
    observation: 'There is not enough clear visual evidence for a confident check.',
    guidance: 'Keep the relevant part in view and improve the lighting. The coach will look again automatically.'
  };
  return feedback;
}
