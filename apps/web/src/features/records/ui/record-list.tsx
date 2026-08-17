import { CAREER_RECORD_KINDS, type Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { KIND_LABELS, pointTextsOf, type RecordFilters, recordRows } from "../model/record-rows.js";

const ARCHIVED_OPTIONS = [
  { value: "exclude", label: "Live" },
  { value: "include", label: "All" },
  { value: "only", label: "Archived" },
] as const;

function Chip({
  to,
  search,
  active,
  children,
}: {
  to: string;
  search: Record<string, unknown>;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={
        active
          ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-400"
      }
    >
      {children}
    </Link>
  );
}

// One list for every kind: only the kind-specific block differs.
export function RecordList({ store, filters }: { store: Store; filters: RecordFilters }) {
  const rows = recordRows(store, filters);

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1.5" aria-label="Record kind">
        <Chip
          to="/records"
          search={{ archived: filters.archived }}
          active={filters.kind === undefined}
        >
          All kinds
        </Chip>
        {CAREER_RECORD_KINDS.map((kind) => (
          <Chip
            key={kind}
            to="/records"
            search={{ kind, archived: filters.archived }}
            active={filters.kind === kind}
          >
            {KIND_LABELS[kind]}
          </Chip>
        ))}
      </nav>

      {/* Archived content is reachable, never hidden: "where did my old entry
          go" must always have an answer. */}
      <nav className="flex gap-1.5" aria-label="Archived">
        {ARCHIVED_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            to="/records"
            search={{
              ...(filters.kind === undefined ? {} : { kind: filters.kind }),
              archived: option.value,
            }}
            active={filters.archived === option.value}
          >
            {option.label}
          </Chip>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty title={filters.archived === "only" ? "Nothing archived here" : "No records yet"}>
          {filters.archived === "only"
            ? "Archiving keeps a record out of the way without destroying it. Nothing here has been put away."
            : "A record is a job, a degree, a project, a talk - anything you might one day want on a resume. Points attach to it afterwards."}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-slate-200 bg-white p-4 data-[archived=true]:opacity-60"
              data-archived={row.isArchived}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-sm font-semibold text-slate-900">{row.title}</h3>
                <span className="shrink-0 text-xs text-slate-500">{KIND_LABELS[row.kind]}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                {[row.organisation, row.subtitle, row.period].filter(Boolean).join(" - ")}
              </p>
              {row.isArchived ? (
                <p className="mt-1 text-xs font-medium text-amber-800">Archived, and kept</p>
              ) : null}
              {row.pointCount === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No points yet. This is where what you actually did goes.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {pointTextsOf(store, row.id).map((text, index) => (
                    <li key={index} className="text-sm text-slate-700">
                      {text || "an empty point"}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
