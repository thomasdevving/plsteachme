import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { skillIds, type SkillId } from "@/lib/config";
import { en } from "@/messages/en";
import { modules } from "@/lib/modules";
import { LessonPlayer } from "@/components/lesson-player";
import { Utilities } from "@/components/utilities";

type Params = Promise<{ locale: string; skill: string }>;
export function generateStaticParams() {
  return skillIds.map((skill) => ({ locale: "en", skill }));
}
function valid(skill: string): skill is SkillId {
  return skillIds.includes(skill as SkillId);
}
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { skill } = await params;
  if (!valid(skill)) return {};
  return {
    title: en.skills.names[skill],
    description: modules[skill].intro,
    alternates: { canonical: `/learn/${skill}` },
  };
}
export default async function LessonPage({ params }: { params: Params }) {
  const { locale, skill } = await params;
  if (!["en", "nl"].includes(locale) || !valid(skill)) notFound();
  return (
    <>
      <LessonPlayer skill={skill} name={en.skills.names[skill]} />
      <Utilities locale="en" />
    </>
  );
}
