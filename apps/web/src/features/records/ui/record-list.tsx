import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { ButtonLink } from "../../../components/ui/button.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import {
  groupedRecordRows,
  KIND_LABELS,
  type RecordFilters,
  type RecordRow,
} from "../model/record-rows.js";

const ARCHIVED_OPTIONS = [
  { value: "exclude", label: "Live" },
  { value: "include", label: "All" },
  { value: "only", label: "Archived" },
] as const;

// The kind being browsed is the kind being added: adding a talk from the talks
// list should not open the form on "experience".
function newRecordSearch(filters: RecordFilters): Record<string, unknown> {
  return filters.kind === undefined ? {} : { kind: filters.kind };
}

function Row({ row }: { row: RecordRow }) {
  return (
    <li>
      <Link
        to="/records/$recordId"
        params={{ recordId: row.id }}
        className="flex items-baseline gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 data-[archived=true]:opacity-60"
        data-archived={row.isArchived}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
          {row.title}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-sm text-slate-500 sm:block">
          {[row.organisation, row.subtitle].filter(Boolean).join(" - ")}
        </span>
        <span className="hidden w-36 shrink-0 text-right text-xs tabular-nums text-slate-500 sm:block">
          {row.period}
        </span>
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-400">
          {row.pointCount === 0
            ? "no points"
            : `${String(row.pointCount)} point${row.pointCount === 1 ? "" : "s"}`}
        </span>
        {row.isArchived ? (
          <Badge tone="warning" className="shrink-0">
            Archived
          </Badge>
        ) : null}
      </Link>
    </li>
  );
}

// Grouped by kind rather than one flat wall: sixty records in one list is a
// scroll nobody reads, and the kind is the first thing anyone narrows by.
export function RecordList({ store, filters }: { store: Store; filters: RecordFilters }) {
  const groups = groupedRecordRows(store, filters);
  const total = groups.reduce((count, group) => count + group.rows.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {filters.kind === undefined ? "Records" : KIND_LABELS[filters.kind]}
          </h1>
          <p className="text-xs text-slate-500">
            {total === 0 ? "Nothing here" : `${String(total)} shown`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Archived content is reachable, never hidden: "where did my old entry
              go" must always have an answer. */}
          <Segmented label="Archived">
            {ARCHIVED_OPTIONS.map((option) => (
              <Segment
                key={option.value}
                to="/records"
                search={{
                  ...(filters.kind === undefined ? {} : { kind: filters.kind }),
                  archived: option.value,
                }}
                active={filters.archived === option.value}
              >
                {option.label}
              </Segment>
            ))}
          </Segmented>
          <ButtonLink tone="primary" to="/records/new" search={newRecordSearch(filters)}>
            New record
          </ButtonLink>
        </div>
      </div>

      {total === 0 ? (
        <Empty title={filters.archived === "only" ? "Nothing archived here" : "No records yet"}>
          {filters.archived === "only" ? (
            "Archiving keeps a record out of the way without destroying it. Nothing here has been put away."
          ) : (
            <>
              A record is a job, a degree, a project, a talk - anything you might one day want on a
              resume. Points attach to it afterwards.
              <span className="mt-4 block">
                <ButtonLink tone="primary" to="/records/new" search={newRecordSearch(filters)}>
                  Add the first one
                </ButtonLink>
              </span>
            </>
          )}
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.kind}>
              {filters.kind === undefined ? (
                <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {KIND_LABELS[group.kind]}
                </h2>
              ) : null}
              <ul className="rounded-xl border border-slate-200 bg-white p-1">
                {group.rows.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
