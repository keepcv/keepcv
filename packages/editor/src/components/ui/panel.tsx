import { createContext, type ReactNode, useContext } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

const Collapsible = createContext(false);

export function Panel({
  className,
  children,
  collapsible = false,
  defaultOpen = false,
}: {
  className?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const classes = cn("rounded-xl border border-line bg-surface shadow-card", className);
  if (collapsible) {
    return (
      <Collapsible.Provider value={true}>
        <details className={cn("group/panel", classes)} open={defaultOpen || undefined}>
          {children}
        </details>
      </Collapsible.Provider>
    );
  }
  return (
    <Collapsible.Provider value={false}>
      <section className={classes}>{children}</section>
    </Collapsible.Provider>
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
  const collapsible = useContext(Collapsible);
  const Tag = collapsible ? "summary" : "header";
  return (
    <Tag
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3",
        collapsible
          ? "cursor-pointer list-none rounded-xl hover:bg-surface-hover group-open/panel:rounded-b-none group-open/panel:border-b group-open/panel:border-line-subtle"
          : "border-b border-line-subtle",
      )}
    >
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          {icon === undefined ? null : <Icon name={icon} size="sm" className="text-text-subtle" />}
          {title}
        </h2>
        {children === undefined ? null : (
          <p className="mt-0.5 text-xs text-text-muted">{children}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {collapsible ? (
          <Icon
            name="chevronDown"
            size="sm"
            className="text-text-subtle transition-transform group-open/panel:rotate-180"
          />
        ) : null}
      </div>
    </Tag>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}
