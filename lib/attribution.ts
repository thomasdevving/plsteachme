'use client';
import type { Locale } from './config';
export function attribution(language: Locale) {
  const fallback = { language, landing_path: '/', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', referrer_domain: '', referral: '' };
  try {
    // Called only on form submission. Keep the source form and language, without
    // reading campaign parameters, referrers or a visitor's browsing history.
    return { ...fallback, landing_path: location.pathname.slice(0, 500) };
  } catch { return fallback; }
}
