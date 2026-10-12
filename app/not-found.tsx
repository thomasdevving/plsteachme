import Link from "next/link";
import { Header } from "@/components/header";
import { copy } from "@/lib/copy/en";
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="narrow-page">
        <h1>{copy.notFound.title}</h1>
        <p>{copy.notFound.detail}</p>
        <Link href="/" className="button primary">
          {copy.common.home}
        </Link>
      </main>
    </>
  );
}
