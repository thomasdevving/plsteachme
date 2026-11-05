import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { type Page } from "@/lib/config";
import { getCopy } from "@/lib/i18n";
import { OG_COACHES, OG_DM_SANS_SEMIBOLD, OG_LORA, OG_MARK } from "@/lib/og-assets";
export async function GET(req: NextRequest) {
  const c = getCopy(
    req.nextUrl.searchParams.get("lang") === "en" ? "en" : "nl",
  );
  const raw = req.nextUrl.searchParams.get("page");
  const page: Page =
    raw === "subscriptions" ||
    raw === "organizations" ||
    raw === "demo" ||
    raw === "privacy" ||
    raw === "thanks" ||
    raw === "learn" ||
    raw === "community" ||
    raw === "teach" ||
    raw === "training" ||
    raw === "vision" ||
    raw === "insights" ||
    raw === "terms"
      ? raw
      : "home";
  const title = {
    home: c.hero.title,
    subscriptions: c.subscriptions.title,
    organizations: c.org.title,
    demo: c.demo.videoLabel,
    privacy: c.legal.title,
    thanks: c.thanks.title,
    learn: "Your next practical skill.",
    community: "Skills shaped by you.",
    teach: "Share what you know.",
    training: "Your training, guided by AI.",
    vision: "Teach the coach to see.",
    insights: "Is it working?",
    terms: "Terms of use",
  }[page];
  // The home image carries the tagline; the page title already sits beside it in a link preview.
  const lines = page === "home" ? ["An AI coach", "for the skills", "nobody taught you."] : [title];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#faf7f2",
        color: "#22372c",
        fontFamily: "DM Sans",
      }}
    >
      {/* A warm disc behind the two coaches. */}
      <div
        style={{
          position: "absolute",
          right: -150,
          top: 40,
          width: 720,
          height: 720,
          borderRadius: 360,
          background: "#f1e4d6",
        }}
      />
      <img
        src={OG_COACHES}
        width={640}
        height={349}
        alt=""
        style={{ position: "absolute", right: -18, bottom: 46 }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 600,
          height: "100%",
          padding: "62px 0 58px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={OG_MARK} width={70} height={70} alt="" />
          <div style={{ display: "flex", fontSize: 54, fontWeight: 600, letterSpacing: -2 }}>
            <span>plsteach</span>
            <span style={{ color: "#bb4827" }}>.me</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Lora",
            fontSize: 56,
            lineHeight: 1.12,
            letterSpacing: -1.5,
            maxWidth: 520,
            flexDirection: "column",
          }}
        >
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        {/* Balances the mark above, so the line sits in the middle. */}
        <div style={{ display: "flex", height: 70 }} />
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "DM Sans", data: bytes(OG_DM_SANS_SEMIBOLD), weight: 600, style: "normal" },
        { name: "Lora", data: bytes(OG_LORA), weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}

/** Decodes an embedded base64 font into the ArrayBuffer the image renderer expects. */
function bytes(base64: string): ArrayBuffer {
  return Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)).buffer;
}
