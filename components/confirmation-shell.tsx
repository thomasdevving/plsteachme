import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from './brand';

export function ConfirmationShell({children}:{children:ReactNode}) {
  return <div className="confirmation-page">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="auth-header container">
      <a href="/" className="wordmark" aria-label="plsteach.me home"><BrandMark/></a>
      <a href="/" className="text-link"><ArrowLeft size={17} aria-hidden="true"/>Back to home</a>
    </header>
    <main id="main" className="confirmation-main">{children}</main>
    <footer className="confirmation-footer container"><a href="/privacy">Privacy statement</a><a href="/terms">Terms of use</a></footer>
  </div>;
}
