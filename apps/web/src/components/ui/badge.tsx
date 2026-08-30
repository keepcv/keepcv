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
  onRemove,
  removeLabel,
  children,
}: {
  tone?: keyof typeof TONES;
  icon?: GlyphName;
  className?: string;
  // Taking the thing off is part of the chip rather than a second control
  // beside it. Three screens had built this by hand and all three spelled the
  // affordance as a literal "x", which is a letter where every other control in
  // the app carries a glyph.
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border py-0.5 text-xs font-medium",
        onRemove === undefined ? "px-1.5" : "pl-1.5 pr-1",
        TONES[tone],
        className,
      )}
    >
      {icon === undefined ? null : <Icon name={icon} size="xs" />}
      {children}
      {onRemove === undefined ? null : (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={onRemove}
          className="rounded px-0.5 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Icon name="close" size="xs" />
        </button>
      )}
    </span>
  );
}
