import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import { KIND_LABELS } from "../../records/model/record-rows.js";
import { type SearchFilters, type SearchRow, searchRows } from "../model/search-rows.js";

function Hit({ row }: { row: SearchRow }) {
  const body: ReactNode = (
    <>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{row.title}</span>
      <span className="hidden w-56 shrink-0 truncate text-right text-xs text-slate-500 sm:block">
        {row.context}
      </span>
      <Badge className="shrink-0">{row.subject === "point" ? "Point" : "Record"}</Badge>
      {row.kind === null ? null : <Badge className="shrink-0">{KIND_LABELS[row.kind]}</Badge>}
      {row.isArchived ? (
        <Badge tone="warning" className="shrink-0">
          Archived
        </Badge>
      ) : null}
    </>
  );

  return (
    <li>
      {row.recordId === null ? (
        <span className="flex items-baseline gap-3 px-3 py-2">{body}</span>
      ) : (
        <Link
          to="/records/$recordId"
          params={{ recordId: row.recordId }}
          className="flex items-baseline gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          {body}
        </Link>
      )}
    </li>
  );
}

// Answered from the cached store, so this is a pure function of what the client
// already holds - no request per keystroke (data-model.md #8).
export function SearchResults({ store, filters }: { store: Store; filters: SearchFilters }) {
  const rows = filters.q.trim() === "" ? [] : searchRows(store, filters);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Search</h1>
          <p className="text-xs text-slate-500">
            {filters.q.trim() === ""
              ? "Matches on prefixes, so it answers while you are still typing"
              : `${String(rows.length)} for "${filters.q}"`}
          </p>
        </div>
        <Segmented label="Archived">
          <Segment to="/search" search={{ q: filters.q }} active={!filters.archived}>
            Live
          </Segment>
          <Segment to="/search" search={{ q: filters.q, archived: true }} active={filters.archived}>
            Include archived
          </Segment>
        </Segmented>
      </div>

      {filters.q.trim() === "" ? (
        <Empty title="Type to search">
          Records and points together, ranked by where the words landed: what a thing is called
          beats what it is filed under.
        </Empty>
      ) : rows.length === 0 ? (
        <Empty title={`Nothing matches "${filters.q}"`}>
          Every word has to land somewhere, so a second word narrows rather than widens. Archived
          rows are excluded unless you ask for them.
        </Empty>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white p-1">
          {rows.map((row) => (
            <Hit key={row.key} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
