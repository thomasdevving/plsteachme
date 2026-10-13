'use client';
import type { Locale } from './config';
const key = 'plsteach:attribution';
export function attribution(language: Locale) {
  const fallback = { language, landing_path: '/', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', referrer_domain: '', referral: '' };
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) { const parsed = JSON.parse(saved); if (parsed && typeof parsed === 'object' && Object.keys(fallback).every(k => typeof parsed[k] === 'string')) return { ...fallback, ...Object.fromEntries(Object.keys(fallback).map(k => [k, parsed[k].slice(0, k === 'landing_path' ? 500 : 200)])), language }; }
    const query = new URLSearchParams(location.search);
    const result = { ...fallback, landing_path: location.pathname.slice(0, 500), referrer_domain: document.referrer ? new URL(document.referrer).hostname.slice(0,200) : '', referral: /^[a-zA-Z0-9_-]{1,32}$/.test(query.get('ref') || '') ? query.get('ref')! : '', ...Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content'].map(k => [k, (query.get(k) || '').slice(0,200)])) };
    sessionStorage.setItem(key, JSON.stringify(result));
    return result;
  } catch { return fallback; }
}
