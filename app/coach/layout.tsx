import { PWA } from "@/components/pwa";
import type { Metadata } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "./coach.css";
import "../motion.css";
import { SiteMotion } from "@/components/site-motion";
import { copy } from "@/lib/copy/en";
export const metadata: Metadata = {
  title: { default: copy.brand, template: `%s · ${copy.brand}` },
  description: copy.home.intro,
  icons: { icon: "/brand/hands-filled.png", apple: "/brand/hands-filled.png" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PWA />
        {children}
        <SiteMotion />
      </body>
    </html>
  );
}
