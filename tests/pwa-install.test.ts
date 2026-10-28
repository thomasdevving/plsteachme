// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { INSTALL_DISMISSED_KEY, INSTALL_QUIET_MS, detectSafari, dismissInstall, installDismissed } from '../lib/pwa/install';

const ua = {
  safariMac17: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  safariMac16: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
afterEach(() => localStorage.clear());

it('offers Add to Dock only in Safari 17+ on a Mac, and Home Screen help on iOS', () => {
  expect(detectSafari(ua.safariMac17, 0)).toBe('safari-dock');
  expect(detectSafari(ua.safariMac16, 0)).toBeNull();
  expect(detectSafari(ua.safariMac17, 5)).toBe('ios'); // iPadOS reports a Mac
  expect(detectSafari(ua.iphone, 5)).toBe('ios');
  for (const other of [ua.chromeMac, ua.edgeWin, ua.firefox]) expect(detectSafari(other, 0)).toBeNull();
});

it('remembers a declined install for a month', () => {
  expect(installDismissed()).toBe(false);
  dismissInstall();
  expect(installDismissed()).toBe(true);
  expect(installDismissed(Date.now() + INSTALL_QUIET_MS + 1)).toBe(false);
  localStorage.setItem(INSTALL_DISMISSED_KEY, 'not a date');
  expect(installDismissed()).toBe(false);
});
