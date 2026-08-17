import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

// A mode, not a destination: it looks like a control so it does not read as the
// navigation next to it.
export function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
    >
      {children}
    </nav>
  );
}

export function Segment({
  to,
  search,
  active,
  children,
}: {
  to: string;
  search: Record<string, unknown>;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {children}
    </Link>
  );
}
