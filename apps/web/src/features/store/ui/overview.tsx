import { overview, textOfPoint } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { formatPeriod, KIND_LABELS } from "../../records/model/record-rows.js";

function Total({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Panel className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note === undefined ? null : <p className="text-xs text-slate-500">{note}</p>}
    </Panel>
  );
}

function Nudge({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <li className="flex items-baseline gap-2 text-sm text-slate-700">
      <span className="min-w-6 rounded bg-amber-100 px-1.5 text-center font-medium tabular-nums text-amber-900">
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
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Total label="Records" value={summary.totals.records} />
        <Total label="Points" value={summary.totals.points} />
        <Total label="Archived" value={summary.totals.archived} note="Kept, never deleted." />
      </div>

      {/* Every row here opens: the screen whose job is re-entry cannot be a
          dead end. */}
      <Panel>
        <PanelHeader title="Where you left off">Most recently edited, newest first.</PanelHeader>
        <PanelBody className="px-1 py-1">
          {summary.recentlyEdited.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-600">Nothing edited yet.</p>
          ) : (
            <ul>
              {summary.recentlyEdited.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to="/records/$recordId"
                    params={{ recordId: entry.id }}
                    className="flex items-baseline gap-3 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {entry.title ?? "Untitled"}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {KIND_LABELS[entry.kind]}
                    </span>
                    <span className="hidden w-36 shrink-0 text-right text-xs tabular-nums text-slate-400 sm:block">
                      {formatPeriod(entry)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Loose ends">
          Nudges, not errors: a half-entered record is a state the store is designed to hold.
        </PanelHeader>
        <PanelBody>
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
        </PanelBody>
      </Panel>
    </div>
  );
}
