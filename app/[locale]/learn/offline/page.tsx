import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearningShell } from "@/components/learning-shell";
import { OfflineLibrary } from "@/components/offline-library";

// A static, public page: it is the offline shell of the installed app and must
// never contain account data. Downloaded state is read in the browser.
export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Offline lessons",
  description: "Download built-in lessons to practice without an internet connection.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/learn/offline" },
};
export function generateStaticParams() {
  return [{ locale: "en" }];
}
export default async function OfflineLessonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "nl") notFound();
  return <LearningShell page="offline"><OfflineLibrary /></LearningShell>;
}
