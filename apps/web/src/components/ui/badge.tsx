import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

const TONES = {
  neutral: "border-line bg-surface-sunken text-text-muted",
  accent: "border-transparent bg-brand-soft text-brand-text",
  positive: "border-transparent bg-positive-soft text-positive-text",
  warning: "border-transparent bg-caution-soft text-caution-text",
  critical: "border-transparent bg-critical-soft text-critical-text",
} as const;

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  icon?: GlyphName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {icon === undefined ? null : <Icon name={icon} size="xs" />}
      {children}
    </span>
  );
}
