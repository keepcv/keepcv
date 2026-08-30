import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

// Divided by a rule rather than a separator character, so a date range inside
// one part cannot read as two: joined with " - ", an experience row printed
// "Analytical Engines - Ingest platform - Apr 2023 - Present" and the eye had no
// way to tell which dash bound the period together.
export function Meta({ parts, className }: { parts: readonly ReactNode[]; className?: string }) {
  const shown = parts.filter((part) => part !== null && part !== undefined && part !== "");
  if (shown.length === 0) return null;

  return (
    <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      {shown.map((part, at) => (
        <span
          key={`${String(at)}:${typeof part === "string" ? part : ""}`}
          className="border-l border-line pl-2 first:border-0 first:pl-0"
        >
          {part}
        </span>
      ))}
    </span>
  );
}
