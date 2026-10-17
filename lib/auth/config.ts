import "server-only";
export function authConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    url,
    key,
    enabled: Boolean(url && key),
    google: process.env.AUTH_GOOGLE_ENABLED === "true",
    apple: process.env.AUTH_APPLE_ENABLED === "true",
  };
}
