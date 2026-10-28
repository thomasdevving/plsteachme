'use client';
import { useState } from 'react';
import { AppWindow, ArrowRight, CircleCheck, HardDriveDownload } from 'lucide-react';
import { promptInstall, useInstall } from '@/lib/pwa/install';

/**
 * "Get the app" at the bottom of the public site. The button does what this
 * browser can really do: open the install prompt (Chrome, Edge), explain Add to
 * Dock (Safari), or open the lessons when the app is already installed. There is
 * no installer file, so nothing pretends to download one.
 */
export function AppDownload() {
  const { mode } = useInstall();
  const [help, setHelp] = useState(false);
  const [message, setMessage] = useState('');
  return <section className="app-download" aria-labelledby="app-download-title">
    <div className="app-download-copy">
      <p className="app-download-kicker"><img src="/icons/icon-192.png" width={44} height={44} alt="" />The plsteach.me app</p>
      <h2 id="app-download-title">Learn on your laptop, <em>even offline.</em></h2>
      <p>Install plsteach.me to open your lessons in their own window. AI coaching requires internet. Download illustrated lessons to practice independently offline; your progress syncs to your account when you’re back online.</p>
      <div className="app-download-actions">
        {mode === 'installed' ? <a className="button primary" href="/learn">Open your lessons<ArrowRight size={18} aria-hidden="true" /></a>
          : mode === 'prompt' ? <button type="button" className="button primary" onClick={async () => { const done = await promptInstall(); setMessage(done ? 'plsteach.me is installed. Open it from your apps.' : 'No problem. Everything keeps working here in the browser.'); }}><AppWindow size={18} aria-hidden="true" />Install the app</button>
          : mode === 'safari-dock' || mode === 'ios' ? <button type="button" className="button primary" aria-expanded={help} aria-controls="app-download-help" onClick={() => setHelp((open) => !open)}><AppWindow size={18} aria-hidden="true" />{mode === 'ios' ? 'Add to Home Screen' : 'Add to Dock'}</button>
          : <a className="button primary" href="/learn">Start learning<ArrowRight size={18} aria-hidden="true" /></a>}
        <a className="button secondary" href="/learn/offline"><HardDriveDownload size={18} aria-hidden="true" />Download lessons</a>
      </div>
      {help && (mode === 'safari-dock' || mode === 'ios') && <p id="app-download-help" className="app-download-note" role="status">{mode === 'ios' ? 'Tap the Share button, then Add to Home Screen.' : 'In Safari, choose File › Add to Dock. plsteach.me then opens in its own window from the Dock.'}</p>}
      {message && <p className="app-download-note" role="status">{message}</p>}
      <p className="app-download-platforms">{mode === 'unsupported' ? 'Install it from Chrome or Edge on Windows and Mac, or Safari on a Mac. No app store needed.' : 'Free · Windows and macOS · Chrome, Edge or Safari · no app store needed'}</p>
    </div>
    <div className="app-download-window" aria-hidden="true">
      <div className="app-download-titlebar"><span /><span /><span /><img src="/icons/icon-192.png" width={18} height={18} alt="" />plsteach.me</div>
      <div className="app-download-screen">
        <p className="app-download-eyebrow">Step 3 of 7</p>
        <p className="app-download-step">Wrap the wide end behind.</p>
        <div className="app-download-rail"><span className="done" /><span className="done" /><span className="current" /><span /><span /><span /><span /></div>
        <p className="app-download-badge"><CircleCheck size={14} />Available offline</p>
        <div className="app-download-buttons"><span>Back</span><span>Next step</span></div>
      </div>
    </div>
  </section>;
}
