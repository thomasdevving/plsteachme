import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { EvaluationPage } from "@/components/local-pages";
import { internalToolsEnabled } from "@/lib/internal-tools";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Page() {
  if (!internalToolsEnabled()) notFound();
  return (
    <>
      <Header backHref="/coach" />
      <EvaluationPage />
    </>
  );
}
