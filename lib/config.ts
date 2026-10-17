export const BRAND = 'plsteach.me';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100').replace(/\/$/, '');
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_APP_URL || '';
export const VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || '';
export const skillIds = ['tie', 'shaving', 'beard', 'ironing', 'button', 'drill', 'laundry', 'cooking', 'bike'] as const;
export type SkillId = typeof skillIds[number];
export type Locale = 'nl' | 'en';
export type Page = 'home' | 'organizations' | 'demo' | 'privacy' | 'thanks' | 'learn' | 'community' | 'teach';
export function pathFor(_locale: Locale, page: Page = 'home') {
  return { home: '/', organizations: '/organizations', demo: '/demo', privacy: '/privacy', thanks: '/thanks', learn:'/learn',community:'/community',teach:'/teach' }[page];
}
export function pageFromSlug(locale: Locale, slug: string[] = []): Page | 'styleguide' | null {
  const path = `/${slug.join('/')}`;
  if (path === '/dev/styleguide' && process.env.NODE_ENV === 'development') return 'styleguide';
  return (['home', 'organizations', 'demo', 'privacy', 'thanks','learn','community','teach'] as Page[]).find(page => pathFor(locale, page) === path) || null;
}

export const ages = ['under16', '16-17', '18-24', '25-34', '35+'] as const;
export const payments = ['free', 'few', '5-10', 'per-skill', 'unsure'] as const;
