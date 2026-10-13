import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { AnimatedDiagram } from "@/components/animated-diagram";
import { loadSkillGraphics } from "@/lib/skills/graphics";
import { Header } from "@/components/header";
import { getSkill, loadSkills } from "@/lib/skills/loader";
import { copy } from "@/lib/copy/en";
export function generateStaticParams() {
  return loadSkills().map((skill) => ({ id: skill.id }));
}
export default async function SkillIntro({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();
  const available = loadSkills().find((item) => item.status === "available");
  if (skill.status === "coming_soon")
    return (
      <>
        <Header backHref="/" />
        <main className="planned-module page-width">
          <section className="planned-overview">
            {skill.catalog && (
              <div className="planned-art">
                <img
                  src={skill.catalog.previewAsset}
                  alt=""
                  width="320"
                  height="200"
                />
              </div>
            )}
            <span className="badge">{copy.modules.soon}</span>
            <h1>{skill.title}</h1>
            <p className="lead">{skill.description}</p>
          </section>
          <section className="planned-details">
            <h2>{copy.modules.plan}</h2>
            <p>{copy.modules.plannedNote}</p>
            {skill.catalog && (
              <ol className="step-list">
                {skill.catalog.outline.map((item, index) => (
                  <li key={item}>
                    <span className="step-number">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="small-note">{copy.modules.readyNote}</p>
            <Link
              href={available ? `/skills/${available.id}` : "/"}
              className="button primary"
            >
              {copy.modules.tryReady}
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
            <Link href="/#modules" className="quiet-link">
              {copy.modules.browse}
            </Link>
          </section>
        </main>
      </>
    );
  return (
    <>
      <Header backHref="/" backLabel={copy.common.home} />
      <main className="intro-layout page-width">
        <section className="intro-overview">
          <div className="intro-art">
            <AnimatedDiagram
              markup={loadSkillGraphics(skill)[skill.steps[0].id]}
              src={skill.steps[0].demoAsset}
              label={skill.steps[0].title}
            />
          </div>
          <p className="metadata">
            <span>
              <Clock3 size={18} aria-hidden="true" />
              {skill.estimatedMinutes} {copy.common.minutes}
            </span>
            <span>{copy.common.beginner}</span>
          </p>
          <h1>{skill.title}</h1>
          <p className="lead">{copy.intro.note}</p>
          <aside className="mode-note">
            <strong>{copy.intro.mode}</strong>
            <p>{copy.intro.modeDetail}</p>
          </aside>
        </section>
        <section className="intro-details">
          <h2>{copy.intro.learn}</h2>
          <ul className="equipment">
            {skill.equipment.map((item) => (
              <li key={item}>
                <Check size={19} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <h2>{copy.intro.steps}</h2>
          <ol className="step-list">
            {skill.steps.map((step, index) => (
              <li key={step.id}>
                <span className="step-number">{index + 1}</span>
                <span>{step.title}</span>
              </li>
            ))}
          </ol>
          <p className="small-note">{copy.intro.orientation}</p>
          <Link href={`/skills/${id}/intake`} className="button primary">
            {copy.intro.start}
            <ArrowRight size={21} aria-hidden="true" />
          </Link>
        </section>
      </main>
    </>
  );
}
