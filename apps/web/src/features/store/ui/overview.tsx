import { overview, textOfPoint } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import { formatPeriod, KIND_LABELS } from "../../records/model/record-rows.js";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Nudge({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <li className="flex items-baseline gap-2 text-sm text-slate-700">
      <span className="min-w-6 rounded bg-amber-100 px-1.5 text-center font-medium text-amber-900">
        {count}
      </span>
      <span>{children}</span>
    </li>
  );
}

// The cold re-entry screen (application-structure.md #5.1).
export function Overview({ store, asOf }: { store: Store; asOf: string }) {
  const summary = overview(store, { asOf });
  const { unfinished } = summary;
  const nudgeCount =
    unfinished.missingEndDate.length +
    unfinished.pointsWithoutMetrics.length +
    unfinished.expiringCertifications.length +
    unfinished.unplacedPoints.length;

  if (summary.totals.records === 0 && summary.totals.points === 0) {
    return (
      <Empty title="Nothing in the store yet">
        This is the permanent record, not a resume. Add everything you have done; deciding what fits
        on one page happens later, and nothing you write here is ever trimmed away.
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Records">
          <p className="text-3xl font-semibold tabular-nums">{summary.totals.records}</p>
        </Card>
        <Card title="Points">
          <p className="text-3xl font-semibold tabular-nums">{summary.totals.points}</p>
        </Card>
        <Card title="Archived">
          <p className="text-3xl font-semibold tabular-nums">{summary.totals.archived}</p>
          <p className="mt-1 text-xs text-slate-500">Kept, never deleted.</p>
        </Card>
      </div>

      <Card title="What is in the store">
        <ul className="grid gap-1 sm:grid-cols-2">
          {summary.counts.map((count) => (
            <li key={count.kind}>
              <Link
                to="/records"
                search={{ kind: count.kind, archived: "exclude" as const }}
                className="flex items-baseline justify-between rounded px-2 py-1 text-sm hover:bg-slate-50"
              >
                <span className="text-slate-700">{KIND_LABELS[count.kind]}</span>
                <span className="tabular-nums text-slate-500">
                  {count.live}
                  {count.archived > 0 ? ` (+${String(count.archived)} archived)` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Where you left off">
        {summary.recentlyEdited.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing edited yet.</p>
        ) : (
          <ul className="space-y-2">
            {summary.recentlyEdited.map((entry) => (
              <li key={entry.id} className="text-sm">
                <span className="font-medium text-slate-900">{entry.title ?? "Untitled"}</span>
                <span className="ml-2 text-slate-500">
                  {KIND_LABELS[entry.kind]}
                  {formatPeriod(entry) === null ? "" : ` - ${formatPeriod(entry) ?? ""}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Loose ends">
        {nudgeCount === 0 ? (
          <p className="text-sm text-slate-600">Nothing half-finished. Unusual, and good.</p>
        ) : (
          <ul className="space-y-2">
            <Nudge count={unfinished.unplacedPoints.length}>
              points captured but not placed on a record
            </Nudge>
            <Nudge count={unfinished.pointsWithoutMetrics.length}>
              points with no metric, so they say what you did but not what it moved
            </Nudge>
            <Nudge count={unfinished.missingEndDate.length}>
              records that ended without an end date
            </Nudge>
            <Nudge count={unfinished.expiringCertifications.length}>
              certifications lapsing within ninety days
            </Nudge>
          </ul>
        )}
        {unfinished.unplacedPoints.length === 0 ? null : (
          <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3">
            {unfinished.unplacedPoints.slice(0, 5).map((point) => (
              <li key={point.id} className="truncate text-sm text-slate-600">
                {textOfPoint(store, point) || "an empty point"}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
