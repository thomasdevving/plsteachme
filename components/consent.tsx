"use client";
import { useState } from "react";
import { liveCopy as c } from "@/lib/copy/en";
export function PrivacyText() {
  return (
    <>
      <p>{c.privacy}</p>
      <p>{c.privacyVoice}</p>
      <p>{c.age}</p>
    </>
  );
}
export function Consent({
  onAgree,
  onWatch,
}: {
  onAgree: () => void;
  onWatch: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <main className="page-width utility-page">
      <h1>{c.privacyTitle}</h1>
      <PrivacyText />
      <label className="check-row">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        {c.agree}
      </label>
      <button className="button primary" disabled={!agreed} onClick={onAgree}>
        {c.start}
      </button>
      <button className="button secondary" onClick={onWatch}>
        {c.watch}
      </button>
    </main>
  );
}
