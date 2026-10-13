import localFont from 'next/font/local';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BRAND, SITE_URL } from '@/lib/config';
import '../globals.css';
const displayFont = localFont({ src:'../../public/fonts/lora.woff2', variable:'--font-lora', display:'optional', adjustFontFallback:'Times New Roman', preload:true });
const bodyFont = localFont({ src:[{path:'../../public/fonts/dm-sans.woff2',weight:'400'},{path:'../../public/fonts/dm-sans-semibold.woff2',weight:'500 700'}], variable:'--font-body', display:'optional', preload:false });
export const metadata: Metadata = { metadataBase: new URL(SITE_URL), title: { default: BRAND, template: `%s · ${BRAND}` }, icons: { icon: '/brand/hands.png', apple: '/brand/hands.png' }, applicationName: BRAND };
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'nl' && locale !== 'en') notFound();
  return <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}><body>{children}</body></html>;
}
