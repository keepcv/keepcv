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
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-text">
          {icon === undefined ? null : (
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-text">
              <Icon name={icon} size="lg" />
            </span>
          )}
          {title}
        </h1>
        {children === undefined ? null : (
          <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{children}</p>
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
export function Toolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/85 px-3 py-2 backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}
