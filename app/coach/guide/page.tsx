import { Header } from '@/components/header';
import { HomeHero } from '@/components/home-hero';
import { HowItWorks } from '@/components/how-it-works';
import { loadSkills, loadSkillGraphics } from '@/lib/skills/catalog';

export const metadata = { title: 'Guide', description: 'How to use the walkthrough, camera coaching and your free session.' };

export default function GuidePage() {
  const skill = loadSkills().find(item => item.status === 'available');
  if (!skill || skill.status !== 'available') return null;
  const graphics = loadSkillGraphics(skill);
  return <>
    <Header current="guide" />
    <main id="main" className="coach-guide">
      <HomeHero skill={skill} graphics={graphics} />
      <HowItWorks skill={skill} graphics={graphics} />
    </main>
  </>;
}
