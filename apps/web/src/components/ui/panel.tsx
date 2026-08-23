import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  icon,
  aside,
  children,
}: {
  title: string;
  icon?: GlyphName;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line-subtle px-4 py-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          {icon === undefined ? null : <Icon name={icon} size="sm" className="text-text-subtle" />}
          {title}
        </h2>
        {children === undefined ? null : (
          <p className="mt-0.5 text-xs text-text-muted">{children}</p>
        )}
      </div>
      {aside === undefined ? null : <div className="shrink-0">{aside}</div>}
    </header>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}
