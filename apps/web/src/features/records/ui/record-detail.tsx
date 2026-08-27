import type { Point as PointRecord, Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import type { ApiClient } from "../../../lib/api.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import { useUpdatePoint } from "../../points/api/use-points.js";
import { TagPicker } from "../../tags/ui/tag-picker.js";
import { useSetArchived } from "../api/use-records.js";
import { type PointRow, recordDetail } from "../model/record-detail.js";
import { KIND_NAMES } from "../model/record-rows.js";
import { RecordFields } from "./record-fields.js";
import { RecordLinks } from "./record-links.js";

// Divided by a rule rather than a separator character, so a date range inside
// one part cannot read as two.
function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="border-l border-line pl-2 text-sm text-text-muted first:border-0 first:pl-0">
      {children}
    </span>
  );
}

function Point({
  point,
  order,
  row,
}: {
  point: PointRow;
  order: Reorder<PointRecord>;
  row: PointRecord | undefined;
}) {
  return (
    <li
      {...(row === undefined ? {} : order.rowProps(row))}
      className="group border-t border-line-subtle py-3 first:border-t-0 first:pt-0 last:pb-0 data-[held=true]:opacity-40"
    >
      <div className="flex items-baseline gap-1">
        <DragGrip />
        <Link
          to="/points/$pointId/edit"
          params={{ pointId: point.id }}
          className="block min-w-0 flex-1 text-sm text-text underline-offset-2 hover:underline data-[archived=true]:text-text-subtle"
          data-archived={point.isArchived}
        >
          {point.text || "an empty point"}
        </Link>
        {row === undefined ? null : (
          <ReorderControls order={order} row={row} subject={point.text || "an empty point"} />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
        {point.metrics.map((metric) => (
          <Badge key={metric} tone="accent" icon="metric">
            {metric}
          </Badge>
        ))}
        {point.tags.map((tag) => (
          <Badge key={tag} icon="tag">
            {tag}
          </Badge>
        ))}
        {point.isSecondary ? <Badge>also filed elsewhere</Badge> : null}
        {point.isArchived ? <Badge tone="warning">Archived</Badge> : null}
      </div>
    </li>
  );
}

// The order points print in under this record, which is what a resume starts
// from before it reorders them for itself.
function Points({
  store,
  client,
  recordId,
  points,
}: {
  store: Store;
  client: ApiClient;
  recordId: Uuid;
  points: PointRow[];
}) {
  const update = useUpdatePoint(client);
  const scope = store.points.filter((row) => row.recordId === recordId);
  const order = useReorder(scope, (point, sortKey) => {
    update.mutate({ point, patch: { sortKey } });
  });

  if (points.length === 0) {
    return (
      <p className="py-2 text-sm text-text-muted">
        Nothing here yet. A point is one thing you did and what it moved - the unit every resume is
        assembled from.
      </p>
    );
  }

  return (
    <ul>
      {points.map((point) => (
        <Point
          key={point.id}
          point={point}
          order={order}
          row={scope.find((row) => row.id === point.id)}
        />
      ))}
    </ul>
  );
}

export function MissingRecord() {
  return (
    <Empty title="No record with that id" spot="noResults">
      It may have been on another store, or the link may be older than the row. Everything the store
      holds is on the records list.
    </Empty>
  );
}

export function RecordDetail({
  store,
  client,
  recordId,
}: {
  store: Store;
  client: ApiClient;
  recordId: Uuid;
}) {
  const setArchived = useSetArchived(client);
  const detail = recordDetail(store, recordId);

  if (detail === undefined) return <MissingRecord />;

  const { record, row, points, links, fields, placements } = detail;

  return (
    <div className="space-y-5">
      <PageHeader
        title={row.title}
        trail={[{ label: "Records", to: "/records", search: { archived: "exclude" } }]}
        actions={
          <>
            <ButtonLink icon="edit" to="/records/$recordId/edit" params={{ recordId }}>
              Edit
            </ButtonLink>
            {/* Archiving is the only removal there is, and it reverses from the
                same button. */}
            <Button
              icon={row.isArchived ? "restore" : "archive"}
              disabled={setArchived.isPending}
              onClick={() => {
                setArchived.mutate({ record, archived: !row.isArchived });
              }}
            >
              {row.isArchived ? "Restore" : "Archive"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge icon="record">{KIND_NAMES[row.kind]}</Badge>
        {row.isArchived ? (
          <Badge tone="warning" icon="archive">
            Archived, and kept
          </Badge>
        ) : null}
        {[row.organisation, row.subtitle, row.period, detail.record.location]
          .filter((part) => part !== null && part !== "")
          .map((part) => (
            <Meta key={part}>{part}</Meta>
          ))}
      </div>

      {setArchived.error === null ? null : <Failure error={setArchived.error} />}

      {/* Two columns: what the record says on the left, what it is filed under
          and where it goes on the right. Six stacked panels buried the points. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-5">
          {detail.summary === "" ? null : (
            <Panel>
              <PanelBody className="text-sm leading-relaxed text-text-muted">
                {detail.summary}
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader
              title="Points"
              icon="point"
              aside={
                <ButtonLink size="sm" icon="add" to="/points/new" search={{ recordId }}>
                  Add a point
                </ButtonLink>
              }
            >
              What you actually did. Wording is chosen per resume; this is the canonical one.
            </PanelHeader>
            <PanelBody>
              <Points store={store} client={client} recordId={recordId} points={points} />
            </PanelBody>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start xl:grid-cols-1">
            <RecordLinks store={store} client={client} recordId={recordId} links={links} />
            <RecordFields store={store} client={client} recordId={recordId} fields={fields} />
          </div>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Tags" icon="tag">
              The words this is filed under. A resume is matched against them, and search reads
              them.
            </PanelHeader>
            <PanelBody>
              <TagPicker store={store} client={client} subject={{ kind: "record", id: recordId }} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Where it appears" icon="resume">
              It stays on every resume it already sits on.
            </PanelHeader>
            <PanelBody>
              {placements.length === 0 ? (
                <p className="text-sm text-text-muted">Not on any resume yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {placements.map((placement) => (
                    <li
                      key={placement.resumeId}
                      className="flex items-center justify-between gap-4"
                    >
                      <Link
                        to="/resumes/$resumeId"
                        params={{ resumeId: placement.resumeId }}
                        search={{ view: "composition" }}
                        className="text-text underline-offset-2 hover:underline"
                      >
                        {placement.resumeName}
                      </Link>
                      {placement.isVisible ? null : <Badge>toggled off</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
