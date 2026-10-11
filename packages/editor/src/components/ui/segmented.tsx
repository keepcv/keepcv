import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

// A mode, not a destination: it looks like a control so it does not read as the
// navigation next to it.
export function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="inline-flex rounded-lg border border-line bg-surface-sunken p-0.5"
    >
      {children}
    </nav>
  );
}

export function Segment({
  to,
  params,
  search,
  active,
  icon,
  children,
}: {
  to: string;
  params?: Record<string, unknown>;
  search: Record<string, unknown>;
  active: boolean;
  icon?: GlyphName;
  children: string;
}) {
  return (
    <Link
      to={to}
      {...(params === undefined ? {} : { params })}
      search={search}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text",
      )}
    >
      {icon === undefined ? null : <Icon name={icon} size="xs" />}
      {children}
    </Link>
  );
}
