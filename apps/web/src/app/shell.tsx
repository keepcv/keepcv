import type { Store } from "@keepcv/schema";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { SearchField } from "../features/search/ui/search-field.js";
import { Brand, Navigation } from "./navigation.js";

function currentQuery(search: unknown): string {
  const q = (search as { q?: unknown }).q;
  return typeof q === "string" ? q : "";
}

export function Shell({ store }: { store: Store }) {
  const search = useRouterState({ select: (state) => state.location.search });

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <Brand className="px-3" />
        <Navigation store={store} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 lg:px-8">
            <Brand className="lg:hidden" />
            <SearchField query={currentQuery(search)} />
          </div>
        </header>

        {/* The same navigation, disclosed rather than resident: a rail costs
            more than the content does at 390px. */}
        <details className="border-b border-slate-200 bg-white px-4 lg:hidden">
          <summary className="cursor-pointer py-2 text-sm font-medium text-slate-600">
            Browse
          </summary>
          <div className="pb-3">
            <Navigation store={store} />
          </div>
        </details>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
