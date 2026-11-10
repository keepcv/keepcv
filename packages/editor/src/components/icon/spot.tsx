import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { DrawerMark } from "../brand/drawer.js";

// Overlapping cards need surface fills or their back edges show through.
const STORE = {
  viewBox: "0 0 240 160",
  art: (
    <g stroke="none">
      <g fill="var(--brand-soft)">
        <rect x="67" y="28" width="67" height="65" rx="5" transform="rotate(-7 100 60)" />
        <rect x="130" y="48" width="46" height="45" rx="5" />
      </g>
      <g fill="none" stroke="var(--brand-text)" strokeWidth="2" strokeLinejoin="round">
        <path d="M70 90V42a4 4 0 0 1 4-4h43l10 10v42M137 89V59a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v30" />
        <path d="M84 57h24M84 69h31M84 81h19" />
      </g>
      <path
        fill="var(--brand-text)"
        fillRule="evenodd"
        d="M38 95h164v40a9 9 0 0 1-9 9H47a9 9 0 0 1-9-9Zm64 18v7h36v-7Z"
      />
    </g>
  ),
};

const SPOTS = {
  emptyStore: STORE,
  permanent: STORE,
  noResults: {
    viewBox: "0 0 160 120",
    art: (
      <>
        <rect x="18" y="26" width="80" height="62" rx="4" className="fill-surface" />
        <path d="M30 42h44M30 54h36M30 66h22" strokeOpacity="0.4" />
        <circle cx="102" cy="68" r="25" className="fill-surface text-brand" />
        <path d="M120 86l16 16" strokeWidth="3" className="text-brand" />
      </>
    ),
  },
  compose: {
    viewBox: "0 0 240 160",
    art: (
      <g stroke="none">
        <g transform="translate(4 42) scale(1.65)" fill="var(--brand-text)">
          <DrawerMark />
        </g>
        <path d="M111 92h29" stroke="var(--brand-text)" strokeWidth="2" strokeDasharray="3 5" />
        <circle cx="140" cy="92" r="3" fill="var(--brand-text)" />
        <rect
          x="155"
          y="19"
          width="67"
          height="122"
          rx="5"
          fill="var(--surface)"
          stroke="var(--text-muted)"
          strokeWidth="2"
        />
        <path
          d="M169 38h30M169 52h40M169 114h37M169 126h24"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="164" y="77" width="49" height="24" rx="3" fill="var(--brand-soft)" />
        <circle cx="173" cy="89" r="3" fill="var(--brand-text)" />
        <path d="M182 89h22" stroke="var(--brand-text)" strokeWidth="2" />
      </g>
    ),
  },
  versions: {
    viewBox: "0 0 160 120",
    art: (
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
  },
  snapshot: {
    viewBox: "0 0 240 160",
    art: (
      <g stroke="none">
        <rect
          x="61"
          y="37"
          width="70"
          height="103"
          rx="5"
          fill="var(--surface)"
          stroke="var(--text-muted)"
          strokeWidth="2"
          transform="rotate(-9 96 88)"
        />
        <rect
          x="84"
          y="28"
          width="70"
          height="103"
          rx="5"
          fill="var(--brand-soft)"
          stroke="var(--brand-text)"
          strokeWidth="2"
          transform="rotate(-3 119 79)"
        />
        <rect
          x="106"
          y="20"
          width="70"
          height="103"
          rx="5"
          fill="var(--surface)"
          stroke="var(--text-muted)"
          strokeWidth="2"
        />
        <path
          d="M120 40h38M120 54h38M120 68h25M120 93h38M120 107h31"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="180"
          cy="119"
          r="24"
          fill="var(--brand-soft)"
          stroke="var(--brand-text)"
          strokeWidth="2"
        />
        <path
          d="m180 105 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z"
          fill="none"
          stroke="var(--brand-text)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
    ),
  },
} as const;

export type SpotName = keyof typeof SPOTS;

export function Spot({ name, className }: { name: SpotName; className?: string }): ReactNode {
  const spot = SPOTS[name];
  return (
    <svg
      viewBox={spot.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto w-40 text-text-subtle", className)}
    >
      {spot.art}
    </svg>
  );
}
