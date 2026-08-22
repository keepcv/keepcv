import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { NameBox } from "../../../components/ui/name-box.js";
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
        <NameBox
          label="A name for this filter"
          placeholder="What this list is"
          confirm="Save"
          disabled={save.isPending}
          onSave={(name) => {
            save.mutate(filterInput(store, name, narrowing));
            setTyped(null);
          }}
          onCancel={() => {
            setTyped(null);
          }}
        />
      )}
    </div>
  );
}
