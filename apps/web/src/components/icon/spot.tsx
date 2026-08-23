import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

const SPOTS = {
  emptyStore: (
    <>
      <rect x="30" y="22" width="100" height="26" rx="6" strokeOpacity="0.35" />
      <rect x="24" y="44" width="112" height="28" rx="7" strokeOpacity="0.6" />
      <rect
        x="18"
        y="68"
        width="124"
        height="34"
        rx="8"
        strokeDasharray="6 5"
        className="text-brand"
      />
      <path d="M72 85h16M80 77v16" className="text-brand" />
    </>
  ),

  noResults: (
    <>
      <circle cx="68" cy="52" r="28" />
      <path d="M88 72l22 22" strokeWidth="3" />
      <path d="M56 44h24M56 53h20M56 62h13" strokeOpacity="0.45" />
      <circle cx="110" cy="94" r="10" className="text-brand" strokeDasharray="4 4" />
    </>
  ),

  permanent: (
    <>
      <path d="M80 8v20M72 22l8 8 8-8" className="text-brand" />
      <rect x="28" y="36" width="104" height="18" rx="4" />
      <path d="M36 54v46a4 4 0 004 4h80a4 4 0 004-4V54" />
      <path d="M66 72h28" strokeOpacity="0.5" />
      <path d="M66 86h28" strokeOpacity="0.5" />
    </>
  ),

  compose: (
    <>
      <rect x="14" y="30" width="34" height="14" rx="4" strokeOpacity="0.5" />
      <rect x="14" y="52" width="34" height="14" rx="4" className="text-brand" />
      <rect x="14" y="74" width="34" height="14" rx="4" strokeOpacity="0.5" />
      <path d="M58 59h18M70 53l6 6-6 6" className="text-brand" />
      <rect x="88" y="18" width="58" height="84" rx="6" />
      <path d="M98 36h38M98 48h38M98 72h38" strokeOpacity="0.45" />
      <path d="M98 60h26" className="text-brand" />
    </>
  ),

  versions: (
    <>
      <rect x="18" y="32" width="52" height="70" rx="6" strokeOpacity="0.3" />
      <rect x="38" y="26" width="52" height="70" rx="6" strokeOpacity="0.55" />
      <rect x="58" y="20" width="52" height="70" rx="6" />
      <path d="M68 38h32M68 50h32M68 62h20" strokeOpacity="0.45" />
      <circle cx="116" cy="86" r="12" className="text-brand" />
      <path d="M111 86l3.5 3.5L122 82" className="text-brand" />
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
