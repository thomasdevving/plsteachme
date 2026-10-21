import { z } from 'zod';
import { skillIds } from '../config';

// Shared between the browser and the server. Nothing here is trusted on the server
// without a server-side check: a browser can only describe its own screen.
export const VOICE_ACTIONS = ['next', 'back', 'replay', 'pause', 'resume', 'check', 'stop'] as const;
export type VoiceAction = typeof VOICE_ACTIONS[number];
export const VOICE_SESSION_HEADER = 'x-voice-session';
export const VOICE_TOKEN_HEADER = 'x-voice-token';
export const VOICE_POLL_MS = 1500;
export const VOICE_END_REASONS = ['stopped', 'hidden', 'navigation', 'completed', 'time_limit', 'call_ended', 'failed'] as const;

export const voiceStartSchema = z.object({
  skill: z.enum(skillIds),
  step: z.number().int().min(0).max(19),
  consent: z.literal(true),
  over16: z.literal(true)
}).strict();
export const voiceStateSchema = z.object({ step: z.number().int().min(0).max(19), restart: z.boolean(), paused: z.boolean().nullable() }).strict();
export const voiceAckSchema = z.object({
  commandId: z.uuid(),
  applied: z.boolean(),
  step: z.number().int().min(0).max(19).nullable()
}).strict();
export const voiceEndSchema = z.object({ reason: z.enum(VOICE_END_REASONS) }).strict();

export const voiceCommandSchema = z.object({
  id: z.uuid(),
  action: z.enum(VOICE_ACTIONS),
  revision: z.number().int().positive(),
  step: z.number().int().min(0)
});
export type VoiceCommand = z.infer<typeof voiceCommandSchema>;
export const voicePollSchema = z.object({
  status: z.enum(['starting', 'active', 'paused', 'ended']),
  step: z.number().int().min(0).optional(),
  revision: z.number().int().positive().optional(),
  end_reason: z.string().nullable().optional(),
  commands: z.array(voiceCommandSchema)
});
export type VoicePoll = z.infer<typeof voicePollSchema>;

/** The parts of Bolna's web-call mint response the browser SDK needs. */
export const bolnaSessionSchema = z.object({
  run_id: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  agent_id: z.string().min(1).max(100),
  sip_username: z.string().min(1).max(200),
  sip_password: z.string().min(1).max(500),
  sip_domain: z.string().min(1).max(200),
  wss_url: z.string().max(500).regex(/^wss:\/\/[^\s]+$/),
  sip_register: z.boolean(),
  expires_in: z.number().positive().max(3600),
  ice_servers: z.array(z.object({
    urls: z.union([z.string(), z.array(z.string())]),
    username: z.string().optional(),
    credential: z.string().optional()
  }).loose()).max(20)
});
export type BolnaSession = z.infer<typeof bolnaSessionSchema>;

export const voiceStartResponseSchema = z.object({
  session: bolnaSessionSchema,
  voice: z.object({
    id: z.uuid(),
    token: z.string().min(20).max(100),
    step: z.number().int().min(0),
    revision: z.number().int().positive(),
    maxSeconds: z.number().int().positive(),
    remainingSeconds: z.number().int().min(0),
    events: z.boolean()
  })
});
export type VoiceStart = z.infer<typeof voiceStartResponseSchema>['voice'];
