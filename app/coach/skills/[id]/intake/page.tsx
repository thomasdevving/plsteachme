import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { IntakeForm } from "@/components/intake-form";
import { getSkill, loadSkills } from "@/lib/skills/loader";
import { copy } from "@/lib/copy/en";
export function generateStaticParams() {
  return loadSkills()
    .filter((skill) => skill.status === "available")
    .map((skill) => ({ id: skill.id }));
}
export default async function Intake({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill || skill.status !== "available") notFound();
  return (
    <>
      <Header backHref={`/coach/skills/${id}`} />
      <main className="narrow-page intake-page">
        <h1>{copy.intake.title}</h1>
        <p className="lead">{copy.intake.description}</p>
        <IntakeForm skill={skill} />
      </main>
    </>
  );
}
