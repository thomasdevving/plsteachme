import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, HardDriveDownload } from "lucide-react";
import { BrandMark } from "./brand";
import { Utilities } from "./utilities";
import { AccountNavLink } from "./account-nav-link";
import { InstallAppButton } from "./install-app";
import { AppStatus } from "./app-status";

export function LearningShell({
  children,
  page = "learn",
}: {
  children: ReactNode;
  page?: "learn" | "account" | "offline";
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
            <a
              href="/learn/offline"
              className="learning-offline-link"
              aria-current={page === "offline" ? "page" : undefined}
            >
              <HardDriveDownload size={18} aria-hidden="true" />
              <span>Offline lessons</span>
            </a>
            <InstallAppButton />
            <AccountNavLink
              learning
              className={
                page === "account" ? "learning-account-current" : undefined
              }
            />
          </nav>
        </div>
      </header>
      <AppStatus />
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
