import { Header } from "@/components/header";
import { ProgressPage } from "@/components/local-pages";
import { loadSkills } from "@/lib/skills/loader";
export default function Page() {
  return (
    <>
      <Header backHref="/coach" />
      <ProgressPage skills={loadSkills()} />
    </>
  );
}
