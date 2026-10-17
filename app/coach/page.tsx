import { Header } from "@/components/header";
import { ModuleLibrary } from "@/components/module-library";
import { ResumeLesson } from "@/components/resume-lesson";
import { loadSkills } from "@/lib/skills/catalog";
import { skillIds } from "@/lib/config";
import { modules } from "@/lib/modules";
import { en } from "@/messages/en";

export const metadata = { title: "Modules", description: "Choose a practical skill and start a step-by-step lesson." };

export default function Home() {
  const skills = loadSkills();
  const available = skills.filter((skill) => skill.status === "available");
  const entries = skillIds.map(id => ({
    id, title: en.skills.names[id], description: modules[id].intro,
    category: modules[id].category, steps: modules[id].steps.length,
    href: id === 'tie' ? '/coach/skills/tie-four-in-hand' : `/learn?skill=${id}`,
  }));
  return (
    <>
      <Header current="modules" />
      <main id="main" className="coach-library page-width">
        <div className="coach-library-heading">
          <div>
            <h1>Your modules.</h1>
            <p>Choose a skill and start practicing.</p>
          </div>
          <span className="library-total">{entries.length} step-by-step lessons</span>
        </div>
        <ResumeLesson skills={available} />
        <ModuleLibrary entries={entries} />
      </main>
    </>
  );
}
