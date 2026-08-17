import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { type PointRow, recordDetail } from "../model/record-detail.js";
import { KIND_LABELS } from "../model/record-rows.js";

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
      <p
        className="text-sm text-slate-800 data-[archived=true]:text-slate-400"
        data-archived={point.isArchived}
      >
        {point.text || "an empty point"}
      </p>
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

export function RecordDetail({ store, recordId }: { store: Store; recordId: Uuid }) {
  const detail = recordDetail(store, recordId);

  if (detail === undefined) {
    return (
      <Empty title="No record with that id">
        It may have been on another store, or the link may be older than the row. Everything the
        store holds is on the records list.
      </Empty>
    );
  }

  const { row, points, links, fields, tags, placements } = detail;

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
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{row.title}</h1>
          <Badge>{KIND_LABELS[row.kind]}</Badge>
          {row.isArchived ? <Badge tone="warning">Archived, and kept</Badge> : null}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-2">
          {[row.organisation, row.subtitle, row.period, detail.record.location]
            .filter((part) => part !== null && part !== "")
            .map((part) => (
              <Meta key={part}>{part}</Meta>
            ))}
        </p>
        {tags.length === 0 ? null : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {detail.summary === "" ? null : (
        <Panel>
          <PanelBody className="text-sm text-slate-700">{detail.summary}</PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Points"
          aside={<span className="text-xs tabular-nums text-slate-400">{points.length}</span>}
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
                  <span className="text-slate-800">{placement.resumeName}</span>
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
