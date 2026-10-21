import { NextRequest } from 'next/server';
import { z } from 'zod';
import { coachJson, limitedJson } from '@/lib/coaching-security';
import { hash } from '@/lib/storage';
import { logError } from '@/lib/log';
import { fromBolna, voiceConfigured, voiceSettings } from '@/lib/voice/config';
import { skillFromLessonKey, voiceStepContext } from '@/lib/voice/lesson';
import { enqueueVoiceCommand, toolSession, type ToolSession } from '@/lib/voice/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Custom function tools called by the Bolna agent. Each request carries the session ID
// and the session's tool token, substituted by Bolna from the call's user_data, plus the
// agent's tool secret. Whatever the model sends, a tool only reads or queues actions for
// that one session, and lesson content always comes from the server.
const OBSERVATION_MAX_AGE_SECONDS = 45;
const base = { voice_session: z.uuid(), voice_token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) };
const stepNumber = z.coerce.number().int().min(1).max(20);
const schemas = {
  get_current_step: z.object(base).loose(),
  get_latest_observation: z.object(base).loose(),
  request_lesson_action: z.object({ ...base, action: z.enum(['next', 'back', 'replay', 'pause', 'resume', 'stop']), step_number: stepNumber }).loose(),
  request_camera_check: z.object({ ...base, step_number: stepNumber }).loose(),
};
type Tool = keyof typeof schemas;
const reply = (body: Record<string, unknown>, status = 200) => coachJson(body, status);
const unavailable = { available: false, message: 'This voice session is not available. Tell the learner briefly that voice coaching has stopped and they can keep using the lesson on screen.' };

const actionNotes: Record<string, string> = {
  next: 'The screen moves on only if the lesson allows it. This records the learner\'s own check, never a camera confirmation. Wait for the new step before describing it.',
  back: 'The screen will go back one step if possible. Wait for the step before describing it.',
  replay: 'The illustration for this step will replay on screen.',
  pause: 'Coaching will pause, including automatic camera checks. Say one short sentence, then stay quiet until the learner says resume.',
  resume: 'Coaching and automatic camera checks will resume.',
  stop: 'Voice coaching will end. Say a short goodbye.',
};

async function currentStep(session: ToolSession) {
  const skill = skillFromLessonKey(session.lesson_key);
  if (!skill) return null;
  return { ...await voiceStepContext(skill, session.step), step_count: session.step_count, coaching: session.status === 'paused' ? 'paused' : 'active' };
}

function latestObservation(session: ToolSession, cameraCanConfirm: boolean) {
  if (!cameraCanConfirm) return { available: false, reason: 'self_check_step', message: 'The camera cannot confirm this step. Ask the learner to use the written checkpoint.' };
  const observation = session.observation;
  const age = observation && session.observed_at ? Math.round((Date.parse(session.now) - Date.parse(session.observed_at)) / 1000) : null;
  if (!observation || observation.step !== session.step || age === null || age > OBSERVATION_MAX_AGE_SECONDS)
    return { available: false, reason: 'no_recent_check', message: 'There is no recent camera check for this step. Do not guess what the learner is doing. Offer to run a camera check, or use the written checkpoint.' };
  return {
    available: true, seconds_ago: Math.max(0, age), result: observation.status, confidence: observation.confidence,
    observation: observation.observation, guidance: observation.guidance,
    wording: `Describe this as the latest camera check from about ${Math.max(0, age)} seconds ago. It is one still snapshot, not live video. Do not add details it does not state.`,
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  if (!voiceConfigured()) return reply({ error: 'unavailable' }, 503);
  if (!fromBolna(request, 'tool')) return reply({ error: 'unauthorized' }, 401);
  const tool = (await params).tool;
  if (!Object.hasOwn(schemas, tool)) return reply({ error: 'not_found' }, 404);
  const body = await limitedJson(request, 4096);
  if ('error' in body) return reply({ error: body.error }, 400);
  const parsed = schemas[tool as Tool].safeParse(body.data);
  if (!parsed.success) return reply({ error: 'validation', message: 'The tool was called without valid values. Do not retry with guessed values.' }, 400);
  const input = parsed.data as z.infer<typeof schemas.request_lesson_action>;
  const toolHash = hash(input.voice_token);
  try {
    const session = await toolSession(input.voice_session, toolHash);
    if (!session) return reply(unavailable, 401);
    if (session.status === 'ended') return reply(unavailable);
    if (tool === 'get_current_step' || tool === 'get_latest_observation') {
      const context = await currentStep(session);
      if (!context) return reply(unavailable);
      return reply(tool === 'get_current_step' ? context : { step_number: context.step_number, ...latestObservation(session, context.camera_can_confirm) });
    }
    const action = tool === 'request_camera_check' ? 'check' : input.action;
    const queued = await enqueueVoiceCommand(session.id, toolHash, action, input.step_number - 1);
    switch (queued.result) {
      case 'queued': return reply({
        accepted: true, duplicate: queued.duplicate,
        message: action === 'check'
          ? `A camera check was requested for step ${queued.step + 1}. Ask the learner to hold still with the result in view. It takes a few seconds and only works while the camera is on. ${voiceSettings().events ? 'You will be told the result.' : 'Call get_latest_observation when the learner says they are ready.'}`
          : actionNotes[action],
      });
      case 'stale': return reply({ accepted: false, reason: 'step_changed', current_step_number: queued.step + 1, message: `The learner is now on step ${queued.step + 1}. Call get_current_step before saying anything about the step.` });
      case 'paused': return reply({ accepted: false, reason: 'paused', message: 'Coaching is paused. Ask the learner to say resume first.' });
      case 'not_ready': return reply({ accepted: false, reason: 'not_ready', message: 'The lesson screen is still connecting. Try again in a moment.' });
      default: return reply(unavailable);
    }
  } catch (error) {
    logError('voice.tool_failed', { tool }, error);
    return reply({ error: 'storage', message: 'The lesson could not be reached. Tell the learner to use the buttons on screen for now.' }, 503);
  }
}
