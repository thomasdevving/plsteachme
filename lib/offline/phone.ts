'use client';
import { useSyncExternalStore } from 'react';

// Screen width alone would also classify a narrow desktop window as a phone.
// This remains true in phone landscape mode and excludes iPads/Android tablets.
export function isPhoneDevice(userAgent: string, mobile?: boolean) {
  return mobile === true || /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent);
}
const subscribe = () => () => {};
const serverSnapshot = () => false;
function snapshot() {
  const device = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return isPhoneDevice(device.userAgent, device.userAgentData?.mobile);
}
/** The static public offline shell stays the same for every device. */
export function usePhoneDevice() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
