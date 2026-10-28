import { BRAND } from "../config";

/** Baked in at build time (next.config.ts); every deploy gets a new value. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

/** The installed app opens straight into the learning environment. */
export const APP_START_URL = "/learn";
/**
 * The app window covers the whole origin so sign-in, email confirmation and
 * account pages stay inside it. Scope only decides what opens in the app window;
 * what may be cached offline is decided separately in public/sw.js.
 */
export const APP_SCOPE = "/";
export const APP_ID = "/learn";
export const APP_NAME = BRAND;
export const APP_SHORT_NAME = BRAND;
export const APP_BACKGROUND = "#faf7f2";
export const APP_THEME = "#22372c";

/** The public page shown when the app starts or navigates without a connection. */
export const OFFLINE_SHELL_PATH = "/learn/offline";

/** CacheStorage names. public/sw.js uses the same prefix and marker. */
export const OFFLINE_CACHE_PREFIX = "plsteach-offline:";
export const PACKAGE_MARKER = "/__plsteach-offline/package.json";
export const PACKAGE_FORMAT = 1;

export const appIcons = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
] as const;
