import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

const TONES = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  accent: "border-indigo-200 bg-indigo-50 text-indigo-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
