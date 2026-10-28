import { notFound } from "next/navigation";
import { TrainingPlayer } from "@/components/training-player";
import { Utilities } from "@/components/utilities";

export const metadata = {
  title: "Your training",
  robots: { index: false, follow: false },
};
export default async function TrainingLesson({
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
      <TrainingPlayer moduleId={id} />
      <Utilities locale="en" />
    </>
  );
}
