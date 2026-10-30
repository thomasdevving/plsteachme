import Image from "next/image";

/** Already compressed; a direct public URL also works in downloaded lessons. */
export function DownloadMascot({ className = "", variant = "app" }: { className?: string; variant?: "app" | "offline" }) {
  return (
    <Image
      className={`download-mascot ${className}`}
      src={variant === "offline" ? "/mascots/offline-practice.webp" : "/mascots/download-companion.webp"}
      width={720}
      height={720}
      alt=""
      unoptimized
    />
  );
}
