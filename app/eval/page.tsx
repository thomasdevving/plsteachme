import { Header } from "@/components/header";
import { EvaluationPage } from "@/components/local-pages";
export default function Page() {
  return (
    <>
      <Header backHref="/" />
      <EvaluationPage />
    </>
  );
}
