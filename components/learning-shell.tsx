import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { BrandMark } from "./brand";
import { Utilities } from "./utilities";
import { AccountNavLink } from "./account-nav-link";

export function LearningShell({
  children,
  page = "learn",
}: {
  children: ReactNode;
  page?: "learn" | "account";
}) {
  return (
    <div className="learning-app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="learning-app-header">
        <div className="container">
          <Link
            href="/learn"
            className="wordmark"
            aria-label="plsteach.me learning home"
          >
            <BrandMark />
          </Link>
          <nav aria-label="Learning navigation">
            <Link
              href="/learn"
              aria-current={page === "learn" ? "page" : undefined}
            >
              <BookOpen size={18} aria-hidden="true" />
              My learning
            </Link>
            <AccountNavLink
              learning
              className={
                page === "account" ? "learning-account-current" : undefined
              }
            />
          </nav>
        </div>
      </header>
      <main
        id="main"
        className={
          page === "account" ? "learning-account-page container" : undefined
        }
      >
        {children}
      </main>
      <Utilities locale="en" />
    </div>
  );
}
