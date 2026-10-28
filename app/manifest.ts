import type { MetadataRoute } from "next";
import { APP_BACKGROUND, APP_ID, APP_NAME, APP_SCOPE, APP_SHORT_NAME, APP_START_URL, APP_THEME, appIcons } from "@/lib/pwa/config";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: APP_ID,
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: "Practical skills with illustrated lessons and online camera coaching. Download lessons to practice offline.",
    start_url: APP_START_URL,
    scope: APP_SCOPE,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: "en",
    dir: "ltr",
    categories: ["education", "lifestyle"],
    background_color: APP_BACKGROUND,
    theme_color: APP_THEME,
    icons: appIcons.map((icon) => ({ ...icon })),
  };
}
