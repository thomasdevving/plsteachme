"use client";
import { useId } from "react";

export function AnimatedDiagram({
  markup,
  src,
  label,
  className = "",
}: {
  markup?: string;
  src: string;
  label: string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!markup)
    return (
      <img
        src={src}
        alt={label}
        width="420"
        height="340"
        className={className}
      />
    );
  // Assets come exclusively from validated, repository-owned public/skills SVGs.
  // Scope SVG IDs so two lesson graphics cannot share a marker or accessible name.
  const scoped = markup
    .replace(/id="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
    .replace(/aria-labelledby="[^"]*"/, 'aria-hidden="true"');
  return (
    <div
      className={`animated-diagram ${className}`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: scoped }}
    />
  );
}
