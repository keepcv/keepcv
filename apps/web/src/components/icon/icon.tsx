import { cn } from "../../lib/cn.js";
import { GLYPHS, type GlyphName } from "./glyphs.js";

export type { GlyphName };

const SIZES = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const;

export function Icon({
  name,
  size = "md",
  label,
  className,
}: {
  name: GlyphName;
  size?: keyof typeof SIZES;
  // Supplied only when the icon is the whole control. An icon beside its own
  // label is announced twice unless it stays hidden.
  label?: string;
  className?: string;
}) {
  const Glyph = GLYPHS[name];

  return (
    <Glyph
      size={SIZES[size]}
      strokeWidth={2}
      className={cn("shrink-0", name === "pending" && "animate-spin", className)}
      {...(label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    />
  );
}
