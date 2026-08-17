import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { CompositionEntry, CompositionSection } from "../model/resume-detail.js";
import { resumeDetail } from "../model/resume-detail.js";
import { DocumentPreview } from "./document-preview.js";

export const RESUME_VIEWS = ["composition", "preview"] as const;

export type ResumeView = (typeof RESUME_VIEWS)[number];

const VIEW_LABELS: Record<ResumeView, string> = {
  composition: "Composition",
  preview: "Preview",
};

// Off is a state, not an absence: the row stays visible so the selection can be
// read, and only the document drops it.
function Off() {
  return <Badge>off</Badge>;
}

function Entry({ entry }: { entry: CompositionEntry }) {
  return (
    <li className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0 last:pb-0">
      {/* Wraps rather than hiding: which role, where and when is the whole
          identity of an entry, and dropping it below `sm` leaves a bare title. */}
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 data-[off=true]:opacity-50"
        data-off={!entry.isVisible}
      >
        <Link
          to="/records/$recordId"
          params={{ recordId: entry.recordId }}
          className="min-w-40 flex-1 truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {entry.title}
        </Link>
        {entry.isVisible ? null : <Off />}
        {entry.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <span className="text-xs text-slate-500">{entry.organisation}</span>
        <span className="text-xs tabular-nums text-slate-500">{entry.period}</span>
      </div>

      {entry.points.length === 0 ? (
        entry.available === 0 ? null : (
          <p className="mt-1 text-xs text-slate-400">
            None of its {entry.available} points are on this resume.
          </p>
        )
      ) : (
        <ul className="mt-1.5 space-y-1">
          {entry.points.map((point) => (
            <li
              key={point.id}
              className="flex items-baseline gap-2 text-sm text-slate-700 data-[off=true]:opacity-50"
              data-off={!point.isVisible}
            >
              <span aria-hidden className="text-slate-300">
                -
              </span>
              <span className="min-w-0 flex-1">{point.text || "an empty point"}</span>
              {point.variant === null ? null : <Badge tone="accent">{point.variant}</Badge>}
              {point.isVisible ? null : <Off />}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({ section }: { section: CompositionSection }) {
  return (
    <Panel>
      <PanelHeader
        title={section.heading}
        aside={section.isVisible ? null : <Badge>section off</Badge>}
      />
      <PanelBody>
        {section.entries.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing placed in this section yet.</p>
        ) : (
          <ul>
            {section.entries.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

export function ResumeDetailScreen({
  store,
  resumeId,
  view,
  asOf,
}: {
  store: Store;
  resumeId: Uuid;
  view: ResumeView;
  asOf: string;
}) {
  const detail = resumeDetail(store, resumeId, asOf);

  if (detail === undefined) {
    return (
      <Empty title="No resume with that id">
        It may have been on another store, or the link may be older than the row. Every resume the
        store holds is on the resumes list.
      </Empty>
    );
  }

  const { row, sections, document } = detail;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/resumes"
          search={{ archived: "exclude" }}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Resumes
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{row.name}</h1>
          {row.isArchived ? <Badge tone="warning">Archived, and kept</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {row.target ?? "No target role recorded"}
          {row.applied === null ? "" : ` - sent ${row.applied}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="View">
          {RESUME_VIEWS.map((option) => (
            <Segment
              key={option}
              to="/resumes/$resumeId"
              params={{ resumeId }}
              search={{ view: option }}
              active={view === option}
            >
              {VIEW_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
        <p className="text-xs tabular-nums text-slate-500">
          {row.hidden === 0
            ? "Everything placed prints."
            : `${String(row.hidden)} placed and toggled off, kept either way.`}
        </p>
      </div>

      {view === "preview" ? (
        document === undefined ? (
          <Empty title="Nothing to compile yet" />
        ) : (
          <DocumentPreview document={document} />
        )
      ) : sections.length === 0 ? (
        <Empty title="This resume is empty">
          Sections come first, then the records that go in them, then the points under each. Nothing
          is copied - a resume points at the store.
        </Empty>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <Section key={section.id} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}
