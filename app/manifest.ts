import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "plsteach.me",
    short_name: "plsteach.me",
    description: "A little help. A skill for life.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ee",
    theme_color: "#26392f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
