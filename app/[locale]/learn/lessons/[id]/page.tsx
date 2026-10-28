import { notFound } from "next/navigation";
import { PublishedLessonScreen } from "@/components/published-lesson";
import { Utilities } from "@/components/utilities";

export const metadata = {
  title: "Reviewed lesson",
  robots: { index: false, follow: true },
};
export default async function ReviewedLesson({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (
    !["en", "nl"].includes(locale) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    notFound();
  return (
    <>
      <PublishedLessonScreen id={id} />
      <Utilities locale="en" />
    </>
  );
}
