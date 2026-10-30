import { expect, it } from 'vitest';
import { isPhoneDevice } from '../lib/offline/phone';
it.each([
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari', undefined, true],
  ['Android phone', 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/132.0 Mobile Safari', undefined, true],
  ['mobile client hint', 'Mozilla/5.0', true, true],
  ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/132.0 Safari', false, false],
  ['iPad', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile Safari', undefined, false],
  ['Android tablet', 'Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/132.0 Safari', false, false],
] as const)('recognizes %s without treating a narrow desktop window as a phone', (_name, ua, mobile, expected) => {
  expect(isPhoneDevice(ua, mobile)).toBe(expected);
});
