import { Header } from "@/components/header";
import { SettingsPage } from "@/components/local-pages";
export default function Page() {
  return (
    <>
      <Header backHref="/coach" />
      <SettingsPage />
    </>
  );
}
