import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { loadSkillGraphics } from "@/lib/skills/graphics";
import { SessionCoach } from "@/components/session-coach";
import { getSkill } from "@/lib/skills/loader";
import { copy } from "@/lib/copy/en";
export default async function Session({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ debug?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const skill = getSkill(id);
  if (!skill || skill.status !== "available") notFound();
  return (
    <>
      <Header backHref="/coach" backLabel={copy.session.exit} />
      <SessionCoach
        skill={skill}
        graphics={loadSkillGraphics(skill)}
        debug={query.debug === "1"}
      />
    </>
  );
}
