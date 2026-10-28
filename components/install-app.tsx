'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { AppWindow, X } from 'lucide-react';
import { dismissInstall, promptInstall, useInstall } from '@/lib/pwa/install';

const instructions = {
  'safari-dock': 'In Safari, choose File › Add to Dock. plsteach.me then opens in its own window from the Dock and Launchpad.',
  ios: 'Tap the Share button, then Add to Home Screen.',
};

/**
 * A quiet header action. It appears only when this browser can actually install
 * the app, not when it already runs installed, and stays away for a month after
 * someone declines.
 */
export function InstallAppButton() {
  const { mode, dismissed } = useInstall();
  const [help, setHelp] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => { if (help) panel.current?.focus(); }, [help]);
  if (dismissed || (mode !== 'prompt' && mode !== 'safari-dock')) return null;
  return <div className="install-app">
    <button type="button" className="install-app-button" title="Install plsteach.me" aria-expanded={mode === 'prompt' ? undefined : help} aria-controls={mode === 'prompt' ? undefined : id}
      onClick={() => { if (mode === 'prompt') void promptInstall(); else setHelp((open) => !open); }}>
      <AppWindow size={18} aria-hidden="true" /><span>Install app</span>
    </button>
    {help && mode === 'safari-dock' && <div className="install-app-help" id={id} ref={panel} tabIndex={-1} role="dialog" aria-label="Install plsteach.me" onKeyDown={(event) => { if (event.key === 'Escape') setHelp(false); }}>
      <p>{instructions['safari-dock']}</p>
      <div>
        <button type="button" className="learning-text-button" onClick={() => setHelp(false)}>Got it</button>
        <button type="button" className="learning-text-button" onClick={() => { setHelp(false); dismissInstall(); }}>Don’t show again</button>
      </div>
      <button type="button" className="install-app-close" aria-label="Close" onClick={() => setHelp(false)}><X size={16} aria-hidden="true" /></button>
    </div>}
  </div>;
}

/** The full explanation, shown on the offline lessons page. */
export function InstallAppPanel() {
  const { mode } = useInstall();
  const [message, setMessage] = useState('');
  return <section className="offline-section install-panel" aria-labelledby="install-title">
    <h2 id="install-title">Use plsteach.me as an app</h2>
    {message ? <p role="status">{message}</p> : mode === 'installed' ? <p>You’re using the installed app. It opens straight into your lessons.</p>
      : mode === 'prompt' ? <>
        <p>Install plsteach.me on this computer to open your lessons in their own window, with their own icon. It uses the same account and progress as the website.</p>
        <button type="button" className="button secondary compact" onClick={async () => { const done = await promptInstall(); setMessage(done ? 'plsteach.me is installed. Open it from your apps.' : 'No problem. You can keep learning here in the browser.'); }}><AppWindow size={17} aria-hidden="true" />Install plsteach.me</button>
      </>
      : mode === 'safari-dock' || mode === 'ios' ? <p>{instructions[mode]} It uses the same account and progress as the website.</p>
      : <p>This browser doesn’t offer to install plsteach.me as an app. Everything keeps working here in the browser. To install it, open plsteach.me in Chrome or Edge, or in Safari on a Mac.</p>}
  </section>;
}
