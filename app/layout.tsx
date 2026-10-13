import { PWA } from "@/components/pwa";
import type { Metadata } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "./globals.css";
import { copy } from "@/lib/copy/en";
export const metadata: Metadata = {
  title: { default: copy.brand, template: `%s · ${copy.brand}` },
  description: copy.mission,
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
      </body>
    </html>
  );
}
