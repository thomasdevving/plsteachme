import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "plsteach.me",
    short_name: "plsteach.me",
    description: "A little help. A skill for life.",
    start_url: "/coach",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#22372c",
    scope: "/coach/",
    icons: [
      {
        src: "/brand/hands-filled.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
