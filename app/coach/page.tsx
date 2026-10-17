import { Header } from "@/components/header";
import { HomeHero } from "@/components/home-hero";
import { ModuleLibrary } from "@/components/module-library";
import { HowItWorks } from "@/components/how-it-works";
import { loadSkillGraphics } from "@/lib/skills/graphics";
import { loadSkills } from "@/lib/skills/loader";
import { copy } from "@/lib/copy/en";

export default function Home() {
  const skills = loadSkills();
  const available = skills.filter((skill) => skill.status === "available");
  const featured = available[0];
  const graphics = featured ? loadSkillGraphics(featured) : {};
  return (
    <>
      <Header />
      <main>
        {featured && (
          <HomeHero
            skill={featured}
            graphics={graphics}
            available={available}
          />
        )}
        <ModuleLibrary skills={skills} />
        {featured && <HowItWorks skill={featured} graphics={graphics} />}
      </main>
      <footer className="site-footer page-width">
        {copy.home.walkthrough}
      </footer>
    </>
  );
}
