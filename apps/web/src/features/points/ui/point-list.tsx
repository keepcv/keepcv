import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import {
  POINT_FILTER_LABELS,
  POINT_FILTERS,
  type PointFilter,
  type PointListRow,
  pointRows,
} from "../model/point-rows.js";

const BLURBS: Record<PointFilter, string> = {
  all: "One thing you did and what it moved. Every resume is assembled from these.",
  unplaced: "Captured but filed under no record. Nothing is lost; they are just not sorted yet.",
  unmeasured: "They say what you did but not what it moved. A number is what a reader remembers.",
  archived: "Put away, never deleted, and still on every resume that already printed them.",
};

function Row({ row }: { row: PointListRow }) {
  return (
    <li className="border-t border-slate-100 px-3 py-2.5 first:border-t-0">
      <p
        className="text-sm text-slate-800 data-[archived=true]:text-slate-400"
        data-archived={row.isArchived}
      >
        {row.text || "an empty point"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        {row.recordId === null ? (
          <Badge tone="warning">Unplaced</Badge>
        ) : (
          <Link
            to="/records/$recordId"
            params={{ recordId: row.recordId }}
            className="text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            {row.recordTitle ?? "Untitled"}
          </Link>
        )}
        {row.metrics.map((metric) => (
          <Badge key={metric} tone="accent">
            {metric}
          </Badge>
        ))}
        {row.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        <span className="tabular-nums">
          {row.placements === 0
            ? "on no resume"
            : `on ${String(row.placements)} resume${row.placements === 1 ? "" : "s"}`}
        </span>
      </div>
    </li>
  );
}

export function PointList({ store, filter }: { store: Store; filter: PointFilter }) {
  const rows = pointRows(store, filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Points</h1>
          <p className="text-xs text-slate-500">{BLURBS[filter]}</p>
        </div>
        <Segmented label="Points">
          {POINT_FILTERS.map((option) => (
            <Segment
              key={option}
              to="/points"
              search={{ filter: option }}
              active={filter === option}
            >
              {POINT_FILTER_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
      </div>

      {rows.length === 0 ? (
        <Empty title={filter === "all" ? "No points yet" : "Nothing here"}>
          {filter === "all"
            ? "A point is the atomic unit: one thing you did, and what it moved. Records hold them; resumes select them."
            : "Nothing matches that filter, which on this screen is usually good news."}
        </Empty>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
