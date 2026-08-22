import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { TagPicker } from "../../tags/ui/tag-picker.js";
import { useSetArchived } from "../api/use-records.js";
import { type PointRow, recordDetail } from "../model/record-detail.js";
import { KIND_NAMES } from "../model/record-rows.js";

// Divided by a rule rather than a separator character, so a date range inside
// one part cannot read as two.
function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="border-l border-slate-200 pl-2 text-sm text-slate-600 first:border-0 first:pl-0">
      {children}
    </span>
  );
}

function Point({ point }: { point: PointRow }) {
  return (
    <li className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <Link
        to="/points/$pointId/edit"
        params={{ pointId: point.id }}
        className="block text-sm text-slate-800 underline-offset-2 hover:underline data-[archived=true]:text-slate-400"
        data-archived={point.isArchived}
      >
        {point.text || "an empty point"}
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {point.metrics.map((metric) => (
          <Badge key={metric} tone="accent">
            {metric}
          </Badge>
        ))}
        {point.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        {point.isSecondary ? <Badge>also filed elsewhere</Badge> : null}
        {point.isArchived ? <Badge tone="warning">Archived</Badge> : null}
      </div>
    </li>
  );
}

export function MissingRecord() {
  return (
    <Empty title="No record with that id">
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
      <div>
        <Link
          to="/records"
          search={{ archived: "exclude" }}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Records
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{row.title}</h1>
          <Badge>{KIND_NAMES[row.kind]}</Badge>
          {row.isArchived ? <Badge tone="warning">Archived, and kept</Badge> : null}
          <div className="ml-auto flex gap-2">
            <ButtonLink to="/records/$recordId/edit" params={{ recordId }}>
              Edit
            </ButtonLink>
            {/* Archiving is the only removal there is, and it reverses from the
                same button. */}
            <Button
              tone={row.isArchived ? "secondary" : "danger"}
              disabled={setArchived.isPending}
              onClick={() => {
                setArchived.mutate({ record, archived: !row.isArchived });
              }}
            >
              {row.isArchived ? "Restore" : "Archive"}
            </Button>
          </div>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-2">
          {[row.organisation, row.subtitle, row.period, detail.record.location]
            .filter((part) => part !== null && part !== "")
            .map((part) => (
              <Meta key={part}>{part}</Meta>
            ))}
        </p>
      </div>

      {setArchived.error === null ? null : <Failure error={setArchived.error} />}

      <Panel>
        <PanelHeader title="Tags">
          The words this is filed under. A resume is matched against them, and search reads them.
        </PanelHeader>
        <PanelBody>
          <TagPicker store={store} client={client} subject={{ kind: "record", id: recordId }} />
        </PanelBody>
      </Panel>

      {detail.summary === "" ? null : (
        <Panel>
          <PanelBody className="text-sm text-slate-700">{detail.summary}</PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Points"
          aside={
            <ButtonLink to="/points/new" search={{ recordId }}>
              Add a point
            </ButtonLink>
          }
        >
          What you actually did. Wording is chosen per resume; this is the canonical one.
        </PanelHeader>
        <PanelBody>
          {points.length === 0 ? (
            <p className="py-2 text-sm text-slate-600">
              Nothing here yet. A point is one thing you did and what it moved - the unit every
              resume is assembled from.
            </p>
          ) : (
            <ul>
              {points.map((point) => (
                <Point key={point.id} point={point} />
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      {links.length === 0 && fields.length === 0 ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          {links.length === 0 ? null : (
            <Panel>
              <PanelHeader title="Links" />
              <PanelBody>
                <ul className="space-y-1.5">
                  {links.map((link) => (
                    <li key={link.id} className="truncate text-sm">
                      <a
                        href={link.url}
                        className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        {link.label ?? link.url}
                      </a>
                      <span className="ml-2 text-xs text-slate-400">{link.kind}</span>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          )}
          {fields.length === 0 ? null : (
            <Panel>
              <PanelHeader title="Fields" />
              <PanelBody>
                <dl className="space-y-1.5 text-sm">
                  {fields.map((field) => (
                    <div key={field.id} className="flex justify-between gap-4">
                      <dt className="text-slate-500">{field.label}</dt>
                      <dd className="text-right text-slate-800">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </PanelBody>
            </Panel>
          )}
        </div>
      )}

      <Panel>
        <PanelHeader title="Where it appears">
          Archiving a record leaves it on every resume it sits on, so nothing about a past
          application changes underneath you.
        </PanelHeader>
        <PanelBody>
          {placements.length === 0 ? (
            <p className="text-sm text-slate-600">Not on any resume yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {placements.map((placement) => (
                <li key={placement.resumeId} className="flex items-center justify-between gap-4">
                  <Link
                    to="/resumes/$resumeId"
                    params={{ resumeId: placement.resumeId }}
                    search={{ view: "composition" }}
                    className="text-slate-800 underline-offset-2 hover:underline"
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
  );
}
