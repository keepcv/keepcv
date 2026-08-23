import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

// Archival objects rather than abstract shapes: this store is the drawer a
// resume is drawn out of, and an empty state is the one place with room to say
// so. `fill-surface` wherever one shape overlaps another, or a stroke-only
// stack shows its own back edges through the front card.
const SPOTS = {
  emptyStore: (
    <>
      <rect
        x="52"
        y="10"
        width="56"
        height="32"
        rx="3"
        strokeDasharray="5 4"
        className="fill-surface text-brand"
      />
      <path d="M80 20v12M74 26h12" className="text-brand" />
      <rect x="22" y="56" width="116" height="48" rx="5" className="fill-surface" />
      <path d="M38 56v16M54 56v16M70 56v16M86 56v16M102 56v16M118 56v16" strokeOpacity="0.3" />
      <path d="M22 72h116" strokeOpacity="0.5" />
      <rect x="68" y="82" width="24" height="7" rx="3.5" />
    </>
  ),

  noResults: (
    <>
      <rect x="18" y="26" width="80" height="62" rx="4" className="fill-surface" />
      <path d="M30 42h44M30 54h36M30 66h22" strokeOpacity="0.4" />
      <circle cx="102" cy="68" r="25" className="fill-surface text-brand" />
      <path d="M120 86l16 16" strokeWidth="3" className="text-brand" />
    </>
  ),

  permanent: (
    <>
      <rect x="24" y="34" width="112" height="20" rx="3" className="fill-surface" />
      <path d="M68 44h24" strokeOpacity="0.5" />
      <path d="M32 54v46a4 4 0 004 4h88a4 4 0 004-4V54" className="fill-surface" />
      <circle cx="80" cy="80" r="15" strokeDasharray="4 3" className="text-brand" />
      <path d="M73 80l5 5 9-10" className="text-brand" />
    </>
  ),

  compose: (
    <>
      <rect x="12" y="26" width="42" height="16" rx="2" strokeOpacity="0.45" />
      <rect x="12" y="50" width="42" height="16" rx="2" className="text-brand" />
      <rect x="12" y="74" width="42" height="16" rx="2" strokeOpacity="0.45" />
      <path d="M62 58h16M72 52l6 6-6 6" className="text-brand" />
      <rect x="88" y="14" width="58" height="92" rx="4" className="fill-surface" />
      <path d="M98 32h38M98 44h38M98 74h38M98 86h26" strokeOpacity="0.4" />
      <path d="M98 58h26" className="text-brand" />
    </>
  ),

  versions: (
    <>
      <rect
        x="16"
        y="32"
        width="52"
        height="70"
        rx="4"
        strokeOpacity="0.3"
        className="fill-surface"
      />
      <rect
        x="36"
        y="26"
        width="52"
        height="70"
        rx="4"
        strokeOpacity="0.55"
        className="fill-surface"
      />
      <rect x="56" y="20" width="52" height="70" rx="4" className="fill-surface" />
      <path d="M66 38h32M66 50h32M66 62h20" strokeOpacity="0.4" />
      <circle cx="118" cy="82" r="14" strokeDasharray="4 3" className="fill-surface text-brand" />
      <path d="M112 82l5 5 8-9" className="text-brand" />
    </>
  ),
} as const;

export type SpotName = keyof typeof SPOTS;

export function Spot({ name, className }: { name: SpotName; className?: string }): ReactNode {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-auto w-40 text-text-subtle", className)}
    >
      {SPOTS[name]}
    </svg>
  );
}
