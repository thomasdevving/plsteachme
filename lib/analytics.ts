'use client';
type Event = 'cta_waitlist_click' | 'cta_demo_click' | 'waitlist_submit_success' | 'waitlist_under16' | 'skill_vote' | 'org_form_submit' | 'share_click' | 'demo_video_play';
declare global { interface Window { plausible?: (event: string, options?: { props?: Record<string,string> }) => void; umami?: { track: (event: string, data?: Record<string,string>) => void }; } }
export function track(event: Event, props?: Record<string,string>) {
  // Never pass form values, email, age, free text or referral codes to analytics.
  if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === 'plausible') window.plausible?.(event, { props });
  if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === 'umami') window.umami?.track(event, props);
}
