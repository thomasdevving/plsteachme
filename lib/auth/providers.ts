import "server-only";
import { authConfig } from "./config";
import { fetchWithTimeout } from "../network";

/** The provider must actually be enabled in Supabase before we offer its button. */
export async function authProviders() {
  const { enabled, url, key } = authConfig();
  const unavailable = { google: false, apple: false };
  if (!enabled) return unavailable;
  try {
    const response = await fetchWithTimeout(`${url}/auth/v1/settings`, {
      headers: { apikey: key! },
      cache: "no-store",
    }, 5_000);
    if (!response.ok) return unavailable;
    const settings = await response.json();
    return {
      google: settings.external?.google === true && process.env.AUTH_GOOGLE_ENABLED !== "false",
      apple: settings.external?.apple === true && process.env.AUTH_APPLE_ENABLED !== "false",
    };
  } catch {
    return unavailable;
  }
}
