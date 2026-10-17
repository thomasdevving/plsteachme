// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Utilities } from '../components/utilities';
import { attribution } from '../lib/attribution';
import { track } from '../lib/analytics';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); sessionStorage.clear(); localStorage.clear(); });

it('clears legacy campaign storage and does not start tracking, even with old analytics configuration', () => {
  vi.stubGlobal('React', React);
  vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'plausible');
  vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'example.test');
  sessionStorage.setItem('plsteach:attribution', JSON.stringify({utm_source:'old-campaign'}));
  sessionStorage.setItem('unrelated', 'keep');
  const plausible = vi.fn();
  Object.assign(window, {plausible});
  const {container} = render(<Utilities />);
  track('cta_waitlist_click');
  expect(container.querySelector('script')).toBeNull();
  expect(plausible).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('plsteach:attribution')).toBeNull();
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
});

it('submits only form context, ignoring campaign/referral data and stored browsing history', () => {
  window.history.replaceState({}, '', '/?utm_source=advertiser&ref=person123');
  sessionStorage.setItem('plsteach:attribution', JSON.stringify({utm_source:'old-campaign',landing_path:'/old'}));
  const result = attribution('en');
  expect(result).toEqual({language:'en',landing_path:'/',utm_source:'',utm_medium:'',utm_campaign:'',utm_content:'',referrer_domain:'',referral:''});
  expect(localStorage.length).toBe(0);
});
