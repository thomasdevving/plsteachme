import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { BRAND, SITE_URL } from '@/lib/config';
import { APP_THEME, APP_VERSION } from '@/lib/pwa/config';
import { PWA } from '@/components/pwa';
import '../globals.css';
import '../account.css';
import '../learning.css';
import '../platform.css';
import '../scope.css';
import '../creative.css';
import '../catalog-polish.css';
import '../motion.css';
import '../lesson-screen.css';
import '../offline.css';
import { SiteMotion } from '@/components/site-motion';
const displayFont = localFont({ src:'../../public/fonts/lora.woff2', variable:'--font-lora', display:'optional', adjustFontFallback:'Times New Roman', preload:true });
const bodyFont = localFont({ src:[{path:'../../public/fonts/dm-sans.woff2',weight:'400'},{path:'../../public/fonts/dm-sans-semibold.woff2',weight:'500 700'}], variable:'--font-body', display:'optional', preload:false });
export const metadata: Metadata = { metadataBase: new URL(SITE_URL), title: { default: BRAND, template: `%s · ${BRAND}` }, icons: { icon: '/brand/hands-filled.png', apple: '/icons/apple-touch-icon.png' }, applicationName: BRAND, appleWebApp: { capable: true, title: BRAND, statusBarStyle: 'default' }, other: { 'plsteach-version': APP_VERSION } };
export const viewport: Viewport = { themeColor: APP_THEME };
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'nl' && locale !== 'en') notFound();
  return <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}><body><PWA/>{children}<SiteMotion/></body></html>;
}
