import type { MetadataRoute } from "next";
import { SITE_URL, pathFor, type Page } from "@/lib/config";
export default function sitemap(): MetadataRoute.Sitemap {
  return (
    ["home", "subscriptions", "organizations", "demo", "privacy", "learn", "community", "teach"] as Page[]
  ).map((page) => ({
    url: SITE_URL + pathFor("en", page),
    changeFrequency: "monthly" as const,
    priority: page === "home" ? 1 : 0.6,
  }));
}
