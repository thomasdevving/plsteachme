import Link from "next/link";
import { ArrowRight, Clock3, Scissors } from "lucide-react";
import { Header } from "@/components/header";
import { HowItWorks } from "@/components/how-it-works";
import { SkillPreview } from "@/components/skill-preview";
import { loadSkillGraphics } from "@/lib/skills/graphics";
import { ResumeLesson } from "@/components/resume-lesson";
import { loadSkills } from "@/lib/skills/loader";
import { copy } from "@/lib/copy/en";
export default function Home() {
  const skills = loadSkills();
  const featured = skills.find((skill) => skill.status === "available");
  return (
    <>
      <Header />
      <main className="home-layout page-width">
        <section className="home-intro">
          <p className="mission">{copy.mission}</p>
          <h1>
            {copy.home.title.split("\n").map((line, index) => (
              <span
                key={line}
                className={index === 1 ? "accent-line" : undefined}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="lead">{copy.home.intro}</p>
          <div className="lesson-line" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="intro-footnote">{copy.home.footer}</p>
        </section>
        <section className="skill-picker" aria-labelledby="skills-title">
          <h2 id="skills-title">{copy.home.skills}</h2>
          <ResumeLesson
            skills={skills.filter((skill) => skill.status === "available")}
          />
          {skills.map((skill) =>
            skill.status === "available" ? (
              <article className="skill-card" key={skill.id}>
                <SkillPreview
                  skill={skill}
                  graphics={loadSkillGraphics(skill)}
                />
                <div className="skill-card-content">
                  <div className="metadata">
                    <span>
                      <Clock3 size={16} aria-hidden="true" />
                      {skill.estimatedMinutes} {copy.common.minutes}
                    </span>
                    <span>
                      {skill.difficulty === "beginner"
                        ? copy.common.beginner
                        : skill.difficulty}
                    </span>
                  </div>
                  <h3>{skill.title}</h3>
                  <p>{skill.description}</p>
                  <Link href={`/skills/${skill.id}`} className="button primary">
                    {copy.home.start}
                    <ArrowRight size={21} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ) : (
              <article key={skill.id} className="coming-soon">
                <Scissors aria-hidden="true" size={26} />
                <div>
                  <h3>{skill.title}</h3>
                  <p>{skill.description}</p>
                </div>
                <span className="badge">{copy.home.soon}</span>
              </article>
            ),
          )}
        </section>
      </main>
      {featured && (
        <HowItWorks skill={featured} graphics={loadSkillGraphics(featured)} />
      )}
      <footer className="site-footer page-width">
        {copy.home.walkthrough}
      </footer>
    </>
  );
}
