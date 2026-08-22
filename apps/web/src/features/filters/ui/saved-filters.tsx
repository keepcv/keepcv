import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import type { ApiClient } from "../../../lib/api.js";
import { useForgetFilter, useSaveFilter } from "../api/use-saved-filters.js";
import {
  alreadySaved,
  filterInput,
  type Narrowing,
  pointSearchOf,
  recordSearchOf,
  savedFiltersOf,
} from "../model/saved-filters.js";

const CHIP =
  "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400";

// One row above the list rather than a screen of its own: a saved filter is a
// shortcut back to a list, so it lives where that list is.
export function SavedFilters({
  store,
  client,
  narrowing,
}: {
  store: Store;
  client: ApiClient;
  // What the list is narrowed by right now, which is both what saving would
  // keep and what decides whether it is already saved.
  narrowing: Narrowing;
}) {
  const save = useSaveFilter(client);
  const forget = useForgetFilter(client);
  const [typed, setTyped] = useState<string | null>(null);

  const { subject } = narrowing;
  const rows = savedFiltersOf(store, subject);
  const held = alreadySaved(store, narrowing);
  const to = subject === "record" ? "/records" : "/points";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rows.map((filter) => (
        <span key={filter.id} className={CHIP}>
          <Link
            to={to}
            search={subject === "record" ? recordSearchOf(filter) : pointSearchOf(filter)}
            className="underline-offset-2 hover:underline"
          >
            {filter.name}
          </Link>
          <button
            type="button"
            aria-label={`Forget ${filter.name}`}
            title={`Forget ${filter.name}`}
            onClick={() => {
              forget.mutate(filter);
            }}
            className="text-slate-400 hover:text-slate-900"
          >
            x
          </button>
        </span>
      ))}

      {held !== undefined ? (
        <span className="text-xs text-slate-400">Saved as {held.name}</span>
      ) : typed === null ? (
        <Button
          onClick={() => {
            setTyped("");
          }}
        >
          Save this filter
        </Button>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <input
            aria-label="A name for this filter"
            value={typed}
            placeholder="What this list is"
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            className="min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <Button
            tone="primary"
            disabled={typed.trim() === "" || save.isPending}
            onClick={() => {
              save.mutate(filterInput(store, typed, narrowing));
              setTyped(null);
            }}
          >
            Save
          </Button>
          <Button
            onClick={() => {
              setTyped(null);
            }}
          >
            Cancel
          </Button>
        </span>
      )}
    </div>
  );
}
