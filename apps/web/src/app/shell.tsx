import { Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      activeProps={{ className: "bg-slate-900 text-white hover:bg-slate-900 hover:text-white" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}

export function Shell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <Link to="/" className="text-base font-semibold tracking-tight">
            KeepCV
          </Link>
          <nav className="flex gap-1">
            <NavLink to="/">Overview</NavLink>
            <NavLink to="/records">Records</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
