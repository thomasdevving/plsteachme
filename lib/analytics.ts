'use client';
type Event = 'cta_waitlist_click' | 'cta_demo_click' | 'waitlist_submit_success' | 'waitlist_under16' | 'skill_vote' | 'org_form_submit' | 'share_click' | 'demo_video_play' | 'demo_preview_play';
export function track(_event: Event, _props?: Record<string,string>) {
  // Analytics is deliberately disabled. Introducing it requires a privacy and
  // consent review, not merely setting a deployment environment variable.
}
