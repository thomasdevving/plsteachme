import type { VoiceCommand } from './contract';

// Browser-side rules for voice commands. The server already rejects commands for an old
// revision; this second check covers the moment between a tap and its state report.
export type VoiceLocal = { revision: number; step: number; completed: boolean };
export function decideVoiceCommand(command: VoiceCommand, local: VoiceLocal): 'apply' | 'stale' | 'decline' {
  if (command.revision !== local.revision || command.step !== local.step) return 'stale';
  if (local.completed && ['next', 'back', 'replay', 'check'].includes(command.action)) return 'decline';
  return 'apply';
}

/** Plain-English messages for the Web Call SDK's error codes and our start errors. */
export function voiceErrorMessage(code: string, fallback = '') {
  switch (code) {
    case 'microphone_denied': return 'Microphone access was blocked. Allow it in your browser settings, then try again. The lesson buttons still work.';
    case 'at_capacity': return 'All voice coaching lines are busy right now. Please try again in a minute.';
    case 'autoplay_blocked': return 'Your browser blocked the coach’s audio. Tap Start voice coaching again.';
    case 'connect_failed': return 'Voice coaching could not connect. Check your connection and try again.';
    case 'call_rejected': return 'Voice coaching could not start. Please try again in a moment.';
    case 'already_active': return 'Voice coaching is already running.';
    case 'mint_failed': return fallback || 'Voice coaching could not start. Please try again in a moment.';
    default: return fallback || 'Voice coaching stopped unexpectedly. You can keep using the lesson.';
  }
}

export function startErrorMessage(status: number, error: string, remainingSeconds?: number) {
  if (error === 'busy') return 'Voice coaching is already running in another tab or window. Stop it there first.';
  if (error === 'allowance') return remainingSeconds && remainingSeconds >= 60
    ? `You have about ${Math.floor(remainingSeconds / 60)} voice minutes left, which is less than one call. The lesson buttons and camera coaching still work.`
    : 'You have used your voice coaching minutes. The lesson buttons and camera coaching still work.';
  if (error === 'daily') return 'Voice coaching has reached today’s limit. Please try again tomorrow.';
  if (error === 'at_capacity' || status === 429) return voiceErrorMessage('at_capacity');
  if (status === 401) return 'Please sign in to use voice coaching.';
  if (status === 403) return 'Voice coaching is part of your free coaching session, which is not active for this lesson.';
  if (status === 503) return 'Voice coaching is not available right now. You can keep using the lesson.';
  return 'Voice coaching could not start. Please try again in a moment.';
}

export const endMessages: Record<string, string> = {
  stopped: 'Voice coaching stopped. Your microphone is off.',
  hidden: 'Voice coaching stopped while this page was hidden. Start it again when you are ready.',
  completed: 'Lesson complete. Voice coaching has ended.',
  time_limit: 'This voice call reached its time limit. You can start another if you have minutes left.',
  expired: 'This voice call reached its time limit. You can start another if you have minutes left.',
  voice_stop: 'Voice coaching stopped. Your microphone is off.',
  call_ended: 'The voice call ended. Your microphone is off.',
  abandoned: 'Voice coaching was started again somewhere else, so this call ended.',
  failed: 'Voice coaching stopped unexpectedly. You can keep using the lesson.',
};
