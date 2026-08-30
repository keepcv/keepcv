import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

export interface Crumb {
  label: string;
  to: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
}

function Breadcrumb({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-text-subtle">
      {trail.map((crumb) => (
        <span key={crumb.to + crumb.label} className="flex items-center gap-1">
          <Link
            to={crumb.to}
            {...(crumb.params === undefined ? {} : { params: crumb.params })}
            {...(crumb.search === undefined ? {} : { search: crumb.search })}
            className="rounded transition-colors hover:text-text"
          >
            {crumb.label}
          </Link>
          <Icon name="chevronRight" size="xs" className="text-text-subtle/60" />
        </span>
      ))}
    </nav>
  );
}

// `reading` caps one-line rows at a measure the eye can cross. `full` is for
// rows dense enough to earn the canvas, and those restructure rather than
// spread.
export function PageBody({
  width = "reading",
  className,
  children,
}: {
  width?: "reading" | "full";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("w-full space-y-5", width === "reading" && "mx-auto max-w-5xl", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  icon,
  trail,
  actions,
  children,
}: {
  title: string;
  icon?: GlyphName;
  trail?: readonly Crumb[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {trail === undefined ? null : <Breadcrumb trail={trail} />}
        <h1 className="mt-1 flex items-center gap-2.5 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-text">
          {icon === undefined ? null : (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-text-muted shadow-card">
              <Icon name={icon} size="lg" />
            </span>
          )}
          {title}
        </h1>
        {children === undefined ? null : (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">{children}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

// Sticky against `main`, which is the scroll container: the app header sits
// outside it, so this pins at zero rather than clearing a bar.
export function Toolbar({
  count,
  className,
  children,
}: {
  count?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas/90 pb-2.5 pt-1 backdrop-blur",
        className,
      )}
    >
      {children}
      {count === undefined ? null : (
        <p className="ml-auto shrink-0 text-xs tabular-nums text-text-subtle">{count}</p>
      )}
    </div>
  );
}
