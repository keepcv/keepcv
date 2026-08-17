import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { type ResumeRow, resumeRows } from "../model/resume-rows.js";

function counted(value: number, singular: string, plural: string): string {
  return `${String(value)} ${value === 1 ? singular : plural}`;
}

function Row({ row }: { row: ResumeRow }) {
  return (
    <li>
      <Link
        to="/resumes/$resumeId"
        params={{ resumeId: row.id }}
        className="block rounded-lg px-3 py-2.5 hover:bg-slate-50 data-[archived=true]:opacity-60"
        data-archived={row.isArchived}
      >
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
            {row.name}
          </span>
          {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {row.applied === null ? "not sent" : `sent ${row.applied}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {row.target ?? "No target role recorded"}
        </p>
        <p className="mt-1 text-xs tabular-nums text-slate-400">
          {[
            counted(row.sections, "section", "sections"),
            counted(row.entries, "entry", "entries"),
            counted(row.points, "point", "points"),
          ].join(" - ")}
          {row.hidden === 0 ? "" : ` - ${String(row.hidden)} toggled off`}
        </p>
      </Link>
    </li>
  );
}

export function ResumeList({ store, archived }: { store: Store; archived: ArchivedFilter }) {
  const rows = resumeRows(store, archived);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumes</h1>
          <p className="text-xs text-slate-500">
            A resume is a selection over the store, not a copy of it.
          </p>
        </div>
        <Segmented label="Archived">
          {ARCHIVED_FILTERS.map((option) => (
            <Segment
              key={option}
              to="/resumes"
              search={{ archived: option }}
              active={archived === option}
            >
              {ARCHIVED_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
      </div>

      {rows.length === 0 ? (
        <Empty title={archived === "only" ? "Nothing archived here" : "No resumes yet"}>
          {archived === "only"
            ? "An archived resume keeps every version it ever had, so what you sent stays answerable."
            : "A resume picks records and points out of the store and arranges them. Nothing it leaves out is lost - it stays here, ready for the next one."}
        </Empty>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white p-1">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
