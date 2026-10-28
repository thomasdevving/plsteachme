// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { LearnerTrial, useLearnerTrial } from '../components/learner-trial';
import { LessonQuestions } from '../components/lesson-questions';
import { resetConnectivityForTests } from '../lib/offline/connectivity';

const trial = { id: '11111111-1111-4111-8111-111111111111', skill_id: 'builtin:laundry', completed_steps: 0, total_steps: 7, completed_at: null, started_at: '2026-10-17T00:00:00Z' };
let reachable = true;
const fetcher = vi.fn();
function Protected() { return <span>Active AI: {useLearnerTrial()}</span>; }
beforeEach(() => {
  resetConnectivityForTests();
  reachable = true;
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
  fetcher.mockImplementation(async (url: string) => {
    if (!reachable) throw new TypeError('Failed to fetch');
    if (url === '/api/version') return Response.json({ version: 'test' });
    if (url === '/api/auth/session') return Response.json({ configured: true, user: { id: 'account-id' }, trial });
    if (url === '/api/coaching/session') return Response.json({ available: true });
    return Response.json({ trial });
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetConnectivityForTests(); Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); });
const aiCalls = () => fetcher.mock.calls.filter(([url]) => /^\/api\/(coaching|ask|trial)/.test(url));

it('shows the offline notice, removes AI tools and makes no AI or trial requests while offline', async () => {
  render(<LearnerTrial skillId={trial.skill_id} completedSteps={2} totalSteps={7}><Protected /></LearnerTrial>);
  expect(await screen.findByText(`Active AI: ${trial.id}`)).toBeTruthy();
  const before = aiCalls().length;
  reachable = false;
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  await act(async () => { window.dispatchEvent(new Event('offline')); });
  expect(await screen.findByText('Camera coaching needs an internet connection. You can keep practicing with the illustrated steps.')).toBeTruthy();
  expect(screen.queryByText(/Active AI:/)).toBeNull();
  expect(aiCalls().length).toBe(before);
});

it('checks the service again when the connection returns, without starting anything by itself', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  reachable = false;
  render(<LearnerTrial skillId={trial.skill_id} completedSteps={0} totalSteps={7}><Protected /></LearnerTrial>);
  expect(await screen.findByText(/Coaching is paused while you’re offline/)).toBeTruthy();
  expect(aiCalls()).toHaveLength(0);
  reachable = true;
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(await screen.findByText(`Active AI: ${trial.id}`)).toBeTruthy();
  expect(fetcher.mock.calls.some(([url]) => url === '/api/coaching/session')).toBe(true);
  expect(fetcher.mock.calls.filter(([url, init]) => url === '/api/trial' && JSON.parse(init.body).action === 'start')).toHaveLength(0);
});

it('does not offer the question form offline', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  reachable = false;
  render(<LessonQuestions skill="tie" step={0} />);
  expect(await screen.findByText(/Questions need an internet connection/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Ask the coach' })).toBeNull();
  expect(aiCalls()).toHaveLength(0);
});
