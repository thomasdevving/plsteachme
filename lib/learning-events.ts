'use client';

// Anonymous learning measurement: a random ID per browser (not linked to an
// account), the lesson, the step and its result. No images, text or contact data.
const SESSION_KEY = 'plsteach.learning-session.v1';
export type LearningEvent = { lessonKey: string; kind: 'lesson_start' | 'step' | 'lesson_complete'; step?: number; result?: '' | 'camera_confirmed' | 'self_checked' | 'unresolved' };

export function learningSession() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return null; }
}

let queue: LearningEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  timer = null;
  const session = learningSession();
  const events = queue.splice(0, 20);
  if (!session || !events.length) return;
  void fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session, events }), keepalive: true }).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 0);
}
export function trackLearning(event: LearningEvent) {
  if (typeof window === 'undefined') return;
  queue.push(event);
  if (!timer) timer = setTimeout(flush, 1500);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); flush(); } });
