'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Mic, MicOff, Pause, PhoneOff, Play } from 'lucide-react';
import type { BolnaWebCall } from '@bolna/web-call';
import type { SkillId } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/network';
import { VOICE_POLL_MS, VOICE_SESSION_HEADER, VOICE_TOKEN_HEADER, voicePollSchema, voiceStartResponseSchema, type VoiceAction, type VoiceCommand, type VOICE_END_REASONS } from '@/lib/voice/contract';
import { decideVoiceCommand, endMessages, startErrorMessage, voiceErrorMessage } from '@/lib/voice/client';
import { useLearnerTrial } from './learner-trial';

type Keys = { id: string; token: string };
const VoiceSessionContext = createContext<Keys | null>(null);
export const VoiceSessionProvider = VoiceSessionContext.Provider;
/** The active voice session, if any. Camera checks send it so the server can share its own result. */
export const useVoiceSession = () => useContext(VoiceSessionContext);
export const voiceHeaders = (keys: Keys | null): Record<string, string> => keys ? { [VOICE_SESSION_HEADER]: keys.id, [VOICE_TOKEN_HEADER]: keys.token } : {};

export type VoiceActionResult = { applied: boolean; step: number };
type EndReason = typeof VOICE_END_REASONS[number];
type Phase = 'idle' | 'microphone' | 'connecting' | 'active' | 'paused';
type Session = Keys & { revision: number; step: number; maxSeconds: number };
// One voice call per tab, whichever lesson started it; claimed from the first click.
let activeCall: BolnaWebCall | null = null;
let claimed = false;

export function VoiceCoach({ skill, step, completed, onAction, onSessionChange, onPausedChange }: {
  skill: SkillId; step: number; completed: boolean;
  /** Applies a spoken lesson action through the existing lesson rules. */
  onAction: (action: Exclude<VoiceAction, 'pause' | 'resume' | 'stop'>) => VoiceActionResult;
  onSessionChange: (keys: Keys | null) => void;
  /** Pausing voice coaching also pauses automatic camera checks. */
  onPausedChange: (paused: boolean) => void;
}) {
  const trialId = useLearnerTrial();
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [phase, setPhase] = useState<Phase>('idle');
  const [consent, setConsent] = useState(false);
  const [over16, setOver16] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [callMinutes, setCallMinutes] = useState(5);
  const sdk = useRef<typeof BolnaWebCall | null>(null);
  const call = useRef<BolnaWebCall | null>(null);
  const session = useRef<Session | null>(null);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const startError = useRef('');
  const claimedHere = useRef(false);
  const local = useRef({ step, completed });
  local.current = { step, completed };
  const handlers = useRef({ onAction, onSessionChange, onPausedChange });
  handlers.current = { onAction, onSessionChange, onPausedChange };
  const consentId = useId(), ageId = useId(), headingId = useId();

  // Every session operation runs in order, so a tap, a poll and an acknowledgement never race.
  const enqueue = useCallback((task: () => Promise<void>) => { queue.current = queue.current.then(task).catch(() => {}); return queue.current; }, []);
  const request = useCallback((path: string, init: RequestInit = {}) => {
    const current = session.current;
    if (!current) return Promise.reject(new Error('ended'));
    return fetchWithTimeout(`/api/voice/session/${current.id}${path}`, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', [VOICE_TOKEN_HEADER]: current.token, ...init.headers } }, 8000);
  }, []);

  const finish = useCallback((reason: EndReason, note?: string) => {
    generation.current++;
    const current = session.current, instance = call.current;
    session.current = null; call.current = null;
    if (activeCall === instance) activeCall = null;
    if (claimedHere.current) { claimed = false; claimedHere.current = false; }
    void instance?.stop().catch(() => {});
    if (current) void fetch(`/api/voice/session/${current.id}`, { method: 'DELETE', keepalive: true, headers: { 'Content-Type': 'application/json', [VOICE_TOKEN_HEADER]: current.token }, body: JSON.stringify({ reason }) }).catch(() => {});
    handlers.current.onSessionChange(null);
    handlers.current.onPausedChange(false);
    setPhase('idle'); setSpeaking(false); setMuted(false); setSecondsLeft(null);
    if (note !== undefined) setMessage(note);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWithTimeout('/api/voice/session', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('availability');
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (data.available !== true) { setAvailability('unavailable'); return; }
        if (Number.isFinite(data.maxCallSeconds)) setCallMinutes(Math.max(1, Math.round(data.maxCallSeconds / 60)));
        // Browser-only SDK, loaded before the click so start() still runs inside the gesture.
        const loaded = await import('@bolna/web-call');
        if (!controller.signal.aborted) { sdk.current = loaded.BolnaWebCall; setAvailability('ready'); }
      }).catch(() => { if (!controller.signal.aborted) setAvailability('error'); });
    const hidden = () => { if (document.hidden && (session.current || call.current)) finish('hidden', endMessages.hidden); };
    const leave = () => { if (session.current || call.current) finish('navigation'); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leave);
    return () => { controller.abort(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave); leave(); };
  }, [finish]);

  useEffect(() => { if (completed && session.current) finish('completed', endMessages.completed); }, [completed, finish]);

  // Lesson controls moved the screen: report it so older commands and camera results go stale.
  const syncState = useCallback((restart: boolean, paused: boolean | null = null) => enqueue(async () => {
    const current = session.current;
    if (!current || !restart && paused === null && local.current.step === current.step) return;
    const response = await request('', { method: 'PUT', body: JSON.stringify({ step: local.current.step, restart, paused }) });
    if (response.status === 410) { finish('call_ended', endMessages.call_ended); return; }
    if (!response.ok) return;
    const data = await response.json();
    if (session.current === current) { current.revision = data.revision; current.step = data.step; }
  }), [enqueue, request, finish]);
  // Resetting the lesson remounts the coaching panels (as for the camera), which ends the call.
  useEffect(() => { void syncState(false); }, [step, syncState]);

  const setPaused = useCallback((paused: boolean) => {
    setPhase(paused ? 'paused' : 'active');
    handlers.current.onPausedChange(paused);
  }, []);

  const apply = useCallback(async (command: VoiceCommand) => {
    const current = session.current;
    if (!current) return;
    const verdict = decideVoiceCommand(command, { revision: current.revision, step: local.current.step, completed: local.current.completed });
    const ack = async (applied: boolean, resultStep: number | null) => {
      const response = await request('/ack', { method: 'POST', body: JSON.stringify({ commandId: command.id, applied, step: resultStep }) });
      if (!response.ok) return null;
      const data = await response.json() as { result: string; revision: number; step: number };
      if (session.current === current) { current.revision = data.revision; current.step = data.step; }
      return data;
    };
    if (verdict !== 'apply') { await ack(false, null); return; }
    if (command.action === 'stop') { await ack(true, null); finish('stopped', endMessages.voice_stop); return; }
    if (command.action === 'pause' || command.action === 'resume') {
      // Agreed with the server first, so the session and the screen cannot disagree.
      const data = await ack(true, null);
      if (data?.result === 'applied') setPaused(command.action === 'pause');
      return;
    }
    const result = handlers.current.onAction(command.action);
    await ack(result.applied, result.applied ? result.step : null);
  }, [request, finish, setPaused]);

  const poll = useCallback(async (run: number) => {
    let failures = 0;
    while (run === generation.current && session.current) {
      await new Promise(resolve => setTimeout(resolve, VOICE_POLL_MS));
      if (run !== generation.current) return;
      await enqueue(async () => {
        if (run !== generation.current || !session.current) return;
        let response: Response;
        try { response = await request(''); } catch { response = new Response(null, { status: 599 }); }
        if (run !== generation.current) return;
        if (response.status === 401 || response.status === 404) { finish('failed', endMessages.failed); return; }
        if (!response.ok) { if (++failures >= 4) finish('failed', 'Voice coaching lost its connection to the lesson. You can keep using the buttons.'); return; }
        failures = 0;
        const data = voicePollSchema.safeParse(await response.json().catch(() => null));
        if (!data.success || !session.current) return;
        if (data.data.status === 'ended') { finish('call_ended', endMessages[data.data.end_reason ?? ''] ?? endMessages.call_ended); return; }
        session.current.revision = data.data.revision ?? session.current.revision;
        session.current.step = data.data.step ?? session.current.step;
        for (const command of data.data.commands) { if (run !== generation.current) return; await apply(command); }
      });
    }
  }, [enqueue, request, finish, apply]);

  // The agent's own Total Call Timeout ends the call at the provider; this stops it here too.
  useEffect(() => {
    if (phase !== 'active' && phase !== 'paused') return;
    const timer = setInterval(() => setSecondsLeft(value => {
      if (value === null) return value;
      if (value <= 1) { queueMicrotask(() => finish('time_limit', endMessages.time_limit)); return 0; }
      return value - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [phase, finish]);

  async function start() {
    if (claimed || activeCall || call.current) { setMessage(voiceErrorMessage('already_active')); return; }
    const Sdk = sdk.current;
    if (!Sdk) { setMessage('Voice coaching is still loading. Try again in a moment.'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setMessage('Voice coaching needs a microphone-capable browser on HTTPS or localhost.'); return; }
    claimed = true; claimedHere.current = true;
    const run = ++generation.current;
    setMessage(''); setPhase('microphone'); startError.current = '';
    // Browser speech would talk over the coach.
    window.speechSynthesis?.cancel();
    // Ask for the microphone before any voice minutes are reserved.
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(track => track.stop()); }
    catch (error) {
      if (run !== generation.current) return;
      const name = error instanceof Error ? error.name : '';
      claimed = false; claimedHere.current = false;
      setPhase('idle');
      setMessage(name === 'NotAllowedError' || name === 'SecurityError' ? voiceErrorMessage('microphone_denied') : name === 'NotFoundError' ? 'No microphone was found. The lesson buttons still work.' : 'The microphone could not start. Close other apps using it, then try again.');
      return;
    }
    if (run !== generation.current) return;
    if (document.hidden) { claimed = false; claimedHere.current = false; setPhase('idle'); return; }
    setPhase('connecting');
    const instance = new Sdk({
      getSession: async () => {
        const response = await fetchWithTimeout('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(trialId ? { 'x-coaching-session': trialId } : {}) }, body: JSON.stringify({ skill, step: local.current.step, consent: true, over16: true }) }, 20_000);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { startError.current = startErrorMessage(response.status, data.error, data.remainingSeconds); throw new Error(startError.current); }
        const parsed = voiceStartResponseSchema.safeParse(data);
        if (!parsed.success) { startError.current = voiceErrorMessage('mint_failed'); throw new Error(startError.current); }
        const voice = parsed.data.voice;
        session.current = { id: voice.id, token: voice.token, revision: voice.revision, step: voice.step, maxSeconds: voice.maxSeconds };
        if (run !== generation.current) { const cancelled = session.current; session.current = null; void fetch(`/api/voice/session/${cancelled.id}`, { method: 'DELETE', keepalive: true, headers: { 'Content-Type': 'application/json', [VOICE_TOKEN_HEADER]: cancelled.token }, body: JSON.stringify({ reason: 'stopped' }) }).catch(() => {}); throw new Error('cancelled'); }
        handlers.current.onSessionChange({ id: voice.id, token: voice.token });
        return parsed.data.session;
      },
    });
    call.current = instance; activeCall = instance;
    instance.on('call-start', () => {
      if (run !== generation.current) return;
      setPhase('active'); setSecondsLeft(session.current?.maxSeconds ?? null);
      void syncState(false);
      void poll(run);
    });
    instance.on('call-end', ({ reason }) => { if (run === generation.current) finish(reason === 'failed' ? 'failed' : 'call_ended', reason === 'local-hangup' ? endMessages.stopped : reason === 'failed' ? endMessages.failed : endMessages.call_ended); });
    instance.on('error', error => { if (run === generation.current) finish('failed', voiceErrorMessage(error.code, startError.current)); });
    instance.on('volume-level', level => setSpeaking(level > 0.04));
    instance.start().catch(() => { /* reported through the error event */ });
  }

  function toggleMute() {
    const next = !muted;
    call.current?.setMuted(next);
    setMuted(next);
  }
  function togglePause() {
    const paused = phase !== 'paused';
    setPaused(paused);
    void syncState(false, paused);
  }

  const live = phase === 'active' || phase === 'paused';
  const busy = phase === 'microphone' || phase === 'connecting';
  if (completed && !live && !busy) return message ? <p role="status" className="camera-notice">{message}</p> : null;
  const minutes = secondsLeft === null ? null : Math.max(1, Math.ceil(secondsLeft / 60));
  return <section className="voice-coach" aria-labelledby={headingId}>
    <h4 id={headingId}><Mic size={20} aria-hidden="true"/>Voice coach</h4>
    <p className="camera-intro">Talk with the coach while your hands are busy. Ask it to repeat a step, explain it more simply, go back, or move on when you are ready.</p>
    {!live && !busy && <>
      {availability === 'loading' && <p role="status">Checking voice coaching…</p>}
      {availability === 'unavailable' && <p className="camera-notice">Voice coaching isn’t connected yet. The lesson buttons, camera coach and questions all still work.</p>}
      {availability === 'error' && <p className="camera-notice">Voice coaching could not be checked. Reload this page to try again.</p>}
      {availability === 'ready' && <div className="camera-consent">
        <p>Voice coaching sends your microphone audio to Bolna, our voice provider, which processes it in the United States to understand you and to speak. Bolna may keep a recording and transcript of the call under its own retention policy. plsteach.me does not store your audio or the transcript. Camera images are never sent to Bolna: the coach only receives the short written result of a camera check. Each call lasts up to {callMinutes} minutes and uses your voice minutes. <a href="/privacy">Read the privacy details</a>.</p>
        <label htmlFor={ageId}><input id={ageId} type="checkbox" checked={over16} onChange={event => setOver16(event.target.checked)}/>I am 16 or older.</label>
        <label htmlFor={consentId}><input id={consentId} type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>I agree to send my voice to Bolna while voice coaching is on.</label>
      </div>}
      <button type="button" className="button secondary compact" disabled={availability !== 'ready' || !consent || !over16} onClick={() => { void start(); }}><Mic size={17} aria-hidden="true"/>Start voice coaching</button>
    </>}
    {busy && <p role="status">{phase === 'microphone' ? 'Waiting for microphone permission…' : 'Connecting to your voice coach…'}</p>}
    {busy && <div className="camera-controls"><button type="button" className="button secondary compact" onClick={() => finish('stopped', endMessages.stopped)}><PhoneOff size={16} aria-hidden="true"/>Cancel</button></div>}
    {live && <>
      <p className="camera-current-step" role="status" aria-live="polite"><strong>{phase === 'paused' ? 'Voice coaching paused' : muted ? 'Microphone muted' : speaking ? 'Coach is speaking' : 'Listening'}</strong><br/>{phase === 'paused' ? 'Camera checks are paused too. Say “resume coaching” or tap Resume.' : 'Say “repeat that”, “explain it more simply”, “go back”, “I’m ready for the next step” or “pause coaching”. You can talk over the coach to interrupt.'}</p>
      <p className="camera-limit">While voice coaching is on, the lesson only moves when you say so or press a button. Saying “next” records your own check, never a camera confirmation.{minutes !== null && ` About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left in this call.`}</p>
      <div className="camera-controls">
        <button type="button" className="button secondary compact" aria-pressed={muted} onClick={toggleMute}>{muted ? <><Mic size={16} aria-hidden="true"/>Unmute</> : <><MicOff size={16} aria-hidden="true"/>Mute</>}</button>
        <button type="button" className="button secondary compact" onClick={togglePause}>{phase === 'paused' ? <><Play size={16} aria-hidden="true"/>Resume</> : <><Pause size={16} aria-hidden="true"/>Pause</>}</button>
        <button type="button" className="button secondary compact" onClick={() => finish('stopped', endMessages.stopped)}><PhoneOff size={16} aria-hidden="true"/>Stop voice</button>
      </div>
    </>}
    {message && <p role="status" className="camera-notice">{message}</p>}
  </section>;
}
