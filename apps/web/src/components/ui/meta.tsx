import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

// A rule rather than a separator character, or a date range inside one part
// reads as two: joined with " - " a row printed "Ingest platform - Apr 2023 -
// Present".
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
