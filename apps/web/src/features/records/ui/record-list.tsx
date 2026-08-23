import type { CareerRecord, Store } from "@keepcv/schema";
import { careerRecordPatchSchema } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { ButtonLink } from "../../../components/ui/button.js";
import { PageHeader, Toolbar } from "../../../components/ui/page.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import { recordNarrowing } from "../../filters/model/saved-filters.js";
import { SavedFilters } from "../../filters/ui/saved-filters.js";
import { TaggedNote } from "../../tags/ui/tagged-note.js";
import { useUpdateRecord } from "../api/use-records.js";
import {
  groupedRecordRows,
  KIND_LABELS,
  type RecordFilters,
  type RecordGroup,
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

// Everything the list is narrowed by apart from the control being rendered, so
// changing one narrowing does not silently drop the others.
function narrowing(filters: RecordFilters): Record<string, unknown> {
  return {
    ...(filters.kind === undefined ? {} : { kind: filters.kind }),
    ...(filters.tagId === undefined ? {} : { tag: filters.tagId }),
  };
}

function Row({
  row,
  order,
  entry,
}: {
  row: RecordRow;
  order: Reorder<CareerRecord>;
  entry: CareerRecord | undefined;
}) {
  return (
    <li
      {...(entry === undefined ? {} : order.rowProps(entry))}
      className="group flex items-center gap-1 rounded-lg transition-opacity data-[held=true]:opacity-40"
    >
      <DragGrip />
      <Link
        to="/records/$recordId"
        params={{ recordId: row.id }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover data-[archived=true]:opacity-60"
        data-archived={row.isArchived}
      >
        <span className="min-w-0 flex-[2] truncate text-sm font-medium text-text">{row.title}</span>
        <span className="hidden min-w-0 flex-[2] truncate text-sm text-text-muted sm:block">
          {[row.organisation, row.subtitle].filter(Boolean).join(" - ")}
        </span>
        <span className="hidden w-36 shrink-0 text-right text-xs tabular-nums text-text-subtle sm:block">
          {row.period}
        </span>
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-text-subtle">
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
      {entry === undefined ? null : (
        <span className="flex shrink-0 items-center gap-0.5 pr-1">
          <ReorderControls order={order} row={entry} subject={row.title} />
        </span>
      )}
    </li>
  );
}

// The list a record is dragged within is its kind, and for a custom entry the
// heading it prints under.
function Group({ group, client }: { group: RecordGroup; client: ApiClient }) {
  const update = useUpdateRecord(client);
  const order = useReorder(group.scope, (record, sortKey) => {
    // The patch is a union discriminated on `kind`, so a move carries the kind
    // it is not changing.
    update.mutate({
      id: record.id,
      expectedUpdatedAt: record.updatedAt,
      patch: careerRecordPatchSchema.parse({ kind: record.kind, sortKey }),
      organisation: null,
    });
  });

  return (
    <ul className="rounded-xl border border-line bg-surface p-1 shadow-card">
      {group.rows.map((row) => (
        <Row
          key={row.id}
          row={row}
          order={order}
          entry={group.scope.find((entry) => entry.id === row.id)}
        />
      ))}
    </ul>
  );
}

function Nothing({ filters }: { filters: RecordFilters }) {
  if (filters.tagId !== undefined) {
    return (
      <Empty title="Nothing carries that tag" spot="noResults">
        A record takes a tag on its own screen, and a point takes one on the point screen.
      </Empty>
    );
  }
  if (filters.archived === "only") {
    return (
      <Empty title="Nothing archived here" spot="permanent">
        Archiving keeps a record out of the way without destroying it. Nothing here has been put
        away.
      </Empty>
    );
  }
  return (
    <Empty
      title="No records yet"
      action={
        <ButtonLink
          tone="primary"
          size="lg"
          icon="add"
          to="/records/new"
          search={newRecordSearch(filters)}
        >
          Add the first one
        </ButtonLink>
      }
    >
      A record is a job, a degree, a project, a talk - anything you might one day want on a resume.
      Points attach to it afterwards.
    </Empty>
  );
}

// Grouped by kind rather than one flat wall: sixty records in one list is a
// scroll nobody reads, and the kind is the first thing anyone narrows by.
export function RecordList({
  store,
  client,
  filters,
}: {
  store: Store;
  client: ApiClient;
  filters: RecordFilters;
}) {
  const groups = groupedRecordRows(store, filters);
  const total = groups.reduce((count, group) => count + group.rows.length, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={filters.kind === undefined ? "Records" : KIND_LABELS[filters.kind]}
        icon="record"
        {...(filters.kind === undefined
          ? {}
          : { trail: [{ label: "Records", to: "/records", search: { archived: "exclude" } }] })}
        actions={
          <ButtonLink tone="primary" icon="add" to="/records/new" search={newRecordSearch(filters)}>
            New record
          </ButtonLink>
        }
      >
        {total === 0 ? "Nothing here" : `${String(total)} shown`}
      </PageHeader>

      <Toolbar>
        {/* Archived content is reachable, never hidden: "where did my old entry
            go" must always have an answer. */}
        <Segmented label="Archived">
          {ARCHIVED_OPTIONS.map((option) => (
            <Segment
              key={option.value}
              to="/records"
              search={{ ...narrowing(filters), archived: option.value }}
              active={filters.archived === option.value}
            >
              {option.label}
            </Segment>
          ))}
        </Segmented>
        <SavedFilters store={store} client={client} narrowing={recordNarrowing(filters)} />
      </Toolbar>

      {filters.tagId === undefined ? null : (
        <TaggedNote
          store={store}
          tagId={filters.tagId}
          to="/records"
          search={{ archived: filters.archived }}
        />
      )}

      {total === 0 ? (
        <Nothing filters={filters} />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              {/* Always for a custom entry: its heading is what tells two
                  otherwise identical groups apart. */}
              {filters.kind === undefined || group.kind === "custom_entry" ? (
                <h2 className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  {group.heading}
                </h2>
              ) : null}
              <Group group={group} client={client} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
