import { live, recordCounts } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { KIND_LABELS } from "../features/records/model/record-rows.js";
import { cn } from "../lib/cn.js";

const ACTIVE = "bg-slate-900 text-white hover:bg-slate-900 hover:text-white";

function NavLink({
  to,
  search,
  exact,
  children,
}: {
  to: string;
  search?: Record<string, unknown>;
  exact?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      {...(search === undefined ? {} : { search })}
      activeOptions={{ exact: exact === true, includeSearch: search !== undefined }}
      activeProps={{ className: ACTIVE }}
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}

function Count({ children }: { children: ReactNode }) {
  return <span className="text-xs tabular-nums text-slate-400">{children}</span>;
}

// The kind list is navigation, not a filter bar above the content: eleven chips
// at the top of a list is more chrome than list.
export function Navigation({ store }: { store: Store }) {
  const counts = recordCounts(store).filter((count) => count.live + count.archived > 0);

  return (
    <nav className="flex flex-col gap-6 text-sm" aria-label="Store">
      <div className="flex flex-col gap-0.5">
        <NavLink to="/" exact>
          Overview
        </NavLink>
        <NavLink to="/records" search={{ archived: "exclude" }}>
          All records
          <Count>{live(store.records).length}</Count>
        </NavLink>
        <NavLink to="/points" search={{ filter: "all" }}>
          Points
          <Count>{live(store.points).length}</Count>
        </NavLink>
        <NavLink to="/tags" search={{ filter: "all" }}>
          Tags
          <Count>{live(store.tags).length}</Count>
        </NavLink>
        <NavLink to="/sections" search={{ archived: false }}>
          Sections
          <Count>{live(store.customSections).length}</Count>
        </NavLink>
        <NavLink to="/resumes" search={{ archived: "exclude" }}>
          Resumes
          <Count>{live(store.resumes).length}</Count>
        </NavLink>
      </div>

      {counts.length === 0 ? null : (
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Kinds
          </p>
          {counts.map((count) => (
            <NavLink
              key={count.kind}
              to="/records"
              search={{ kind: count.kind, archived: "exclude" }}
            >
              <span className="truncate">{KIND_LABELS[count.kind]}</span>
              <Count>{count.live}</Count>
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex shrink-0 items-baseline gap-2", className)}>
      <span className="text-base font-semibold tracking-tight text-slate-900">KeepCV</span>
      <span className="hidden text-xs text-slate-400 sm:inline">career store</span>
    </Link>
  );
}
