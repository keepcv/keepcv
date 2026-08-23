import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import { Icon } from "../../../components/icon/icon.js";
import { Badge } from "../../../components/ui/badge.js";
import { PageBody, PageHeader } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import { KIND_NAMES } from "../../records/model/record-rows.js";
import { type SearchFilters, type SearchRow, searchRows } from "../model/search-rows.js";
import { SearchField } from "./search-field.js";

function Hit({ row }: { row: SearchRow }) {
  const body: ReactNode = (
    <>
      <Icon name={row.subject} size="sm" className="shrink-0 text-text-subtle" />
      <span className="min-w-0 flex-1 truncate text-sm text-text">{row.title}</span>
      <span className="hidden w-56 shrink-0 truncate text-right text-xs text-text-subtle sm:block">
        {row.context}
      </span>
      {row.kind === null ? null : <Badge className="shrink-0">{KIND_NAMES[row.kind]}</Badge>}
      {row.isArchived ? (
        <Badge tone="warning" className="shrink-0">
          Archived
        </Badge>
      ) : null}
    </>
  );

  return (
    <li>
      <Link
        to={row.subject === "record" ? "/records/$recordId" : "/points/$pointId/edit"}
        params={row.subject === "record" ? { recordId: row.id } : { pointId: row.id }}
        className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover"
      >
        {body}
      </Link>
    </li>
  );
}

export function SearchResults({ store, filters }: { store: Store; filters: SearchFilters }) {
  const rows = filters.q.trim() === "" ? [] : searchRows(store, filters);

  return (
    <PageBody>
      <PageHeader
        title="Search"
        icon="search"
        actions={
          <Segmented label="Archived">
            <Segment to="/search" search={{ q: filters.q }} active={!filters.archived}>
              Live
            </Segment>
            <Segment
              to="/search"
              search={{ q: filters.q, archived: true }}
              active={filters.archived}
            >
              Include archived
            </Segment>
          </Segmented>
        }
      >
        {filters.q.trim() === ""
          ? "Matches on prefixes, so it answers while you are still typing."
          : `${String(rows.length)} for "${filters.q}"`}
      </PageHeader>

      <SearchField query={filters.q} archived={filters.archived} />

      {filters.q.trim() === "" ? (
        <Empty title="Type to search" spot="noResults">
          Records and points together, ranked by where the words landed: what a thing is called
          beats what it is filed under.
        </Empty>
      ) : rows.length === 0 ? (
        <Empty title={`Nothing matches "${filters.q}"`} spot="noResults">
          Every word has to land somewhere, so a second word narrows rather than widens. Archived
          rows are excluded unless you ask for them.
        </Empty>
      ) : (
        <ul className="rounded-xl border border-line bg-surface p-1 shadow-card">
          {rows.map((row) => (
            <Hit key={row.key} row={row} />
          ))}
        </ul>
      )}
    </PageBody>
  );
}
