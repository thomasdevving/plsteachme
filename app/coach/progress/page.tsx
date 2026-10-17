import { Header } from "@/components/header";
import { ProgressPage } from "@/components/local-pages";
import { loadSkills } from "@/lib/skills/catalog";
export default function Page() {
  return (
    <>
      <Header current="progress" />
      <ProgressPage skills={loadSkills()} />
    </>
  );
}
