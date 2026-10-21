import "server-only";
import { isPublicSupabaseKey } from '../public-key';
export function authConfig() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const candidate =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key=isPublicSupabaseKey(candidate,process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())?candidate:undefined;
  return {
    url,
    key,
    enabled: Boolean(url && key),
    google: process.env.AUTH_GOOGLE_ENABLED === "true",
    apple: process.env.AUTH_APPLE_ENABLED === "true",
    // Cloudflare Turnstile site key; enable CAPTCHA with the same provider in Supabase Auth.
    captchaSiteKey: process.env.TURNSTILE_SITE_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "",
  };
}
