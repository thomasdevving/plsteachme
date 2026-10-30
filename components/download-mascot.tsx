import Image from "next/image";

/** Already compressed; a direct public URL also works in downloaded lessons. */
export function DownloadMascot({ className = "" }: { className?: string }) {
  return (
    <Image
      className={`download-mascot ${className}`}
      src="/mascots/download-companion.webp"
      width={720}
      height={720}
      alt=""
      unoptimized
    />
  );
}
