import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-slate-100 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {children === undefined ? null : (
          <p className="mt-0.5 text-xs text-slate-500">{children}</p>
        )}
      </div>
      {aside}
    </header>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}
