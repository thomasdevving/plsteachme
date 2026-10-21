import { Header } from "@/components/header";
import { SettingsPage } from "@/components/local-pages";
import { internalToolsEnabled } from "@/lib/internal-tools";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <>
      <Header backHref="/coach" />
      <SettingsPage showEvaluation={internalToolsEnabled()} />
    </>
  );
}
