import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { ButtonLink } from "../../../components/ui/button.js";
import { PageBody, PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { counted } from "../../../lib/label.js";
import { pointNarrowing } from "../../filters/model/saved-filters.js";
import { SavedFilters } from "../../filters/ui/saved-filters.js";
import { TaggedNote } from "../../tags/ui/tagged-note.js";
import {
  POINT_FILTER_LABELS,
  POINT_FILTERS,
  type PointFilter,
  type PointFilters,
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
    <li className="border-t border-line-subtle px-3 py-2.5 first:border-t-0">
      <Link
        to="/points/$pointId/edit"
        params={{ pointId: row.id }}
        className="block text-sm text-text underline-offset-2 hover:underline data-[archived=true]:text-text-subtle"
        data-archived={row.isArchived}
      >
        {row.text || "an empty point"}
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-text-subtle">
        {row.recordId === null ? (
          <Badge tone="warning">Unplaced</Badge>
        ) : (
          <Link
            to="/records/$recordId"
            params={{ recordId: row.recordId }}
            className="text-text-muted underline-offset-2 hover:text-text hover:underline"
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
            : `on ${counted(row.placements, "resume", "resumes")}`}
        </span>
      </div>
    </li>
  );
}

function Nothing({ filters }: { filters: PointFilters }) {
  if (filters.tagId !== undefined) {
    return (
      <Empty title="Nothing carries that tag" spot="noResults">
        A point takes a tag on its own screen, and a record takes one on the record screen.
      </Empty>
    );
  }
  if (filters.filter !== "all") {
    return (
      <Empty title="Nothing here" spot="noResults">
        Nothing matches that filter, which on this screen is usually good news.
      </Empty>
    );
  }
  return (
    <Empty
      title="No points yet"
      action={
        <ButtonLink tone="primary" size="lg" icon="add" to="/points/new">
          Write the first one
        </ButtonLink>
      }
    >
      A point is the atomic unit: one thing you did, and what it moved. Records hold them; resumes
      select them.
    </Empty>
  );
}

export function PointList({
  store,
  client,
  filters,
}: {
  store: Store;
  client: ApiClient;
  filters: PointFilters;
}) {
  const rows = pointRows(store, filters);
  const { filter, tagId } = filters;

  return (
    <PageBody>
      <PageHeader
        title="Points"
        icon="point"
        actions={
          <ButtonLink tone="primary" icon="add" to="/points/new">
            New point
          </ButtonLink>
        }
      >
        {BLURBS[filter]}
      </PageHeader>

      <Toolbar count={counted(rows.length, "point", "points")}>
        <Segmented label="Points">
          {POINT_FILTERS.map((option) => (
            <Segment
              key={option}
              to="/points"
              search={{ ...(tagId === undefined ? {} : { tag: tagId }), filter: option }}
              active={filter === option}
            >
              {POINT_FILTER_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
        <SavedFilters store={store} client={client} narrowing={pointNarrowing(filters)} />
      </Toolbar>

      {tagId === undefined ? null : (
        <TaggedNote store={store} tagId={tagId} to="/points" search={{ filter }} />
      )}

      {rows.length === 0 ? (
        <Nothing filters={filters} />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </PageBody>
  );
}
