import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { resumeDetail } from "../model/resume-detail.js";
import { Composer } from "./composer.js";
import { DocumentPreview } from "./document-preview.js";
import { ResumeHistory } from "./resume-history.js";

export const RESUME_VIEWS = ["composition", "preview", "history"] as const;

export type ResumeView = (typeof RESUME_VIEWS)[number];

const VIEW_LABELS: Record<ResumeView, string> = {
  composition: "Composition",
  preview: "Preview",
  history: "History",
};

export function ResumeDetailScreen({
  store,
  client,
  resumeId,
  view,
  asOf,
}: {
  store: Store;
  client: ApiClient;
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

  const { header, document } = detail;

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
          <h1 className="text-xl font-semibold tracking-tight">{header.name}</h1>
          {header.isArchived ? <Badge tone="warning">Archived, and kept</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {header.target ?? "No target role recorded"}
          {header.applied === null ? "" : ` - sent ${header.applied}`}
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
          {header.hidden === 0
            ? "Everything placed prints."
            : `${String(header.hidden)} placed and toggled off, kept either way.`}
        </p>
      </div>

      {view === "history" ? (
        <ResumeHistory client={client} resumeId={resumeId} />
      ) : view === "preview" ? (
        document === undefined ? (
          <Empty title="Nothing to compile yet" />
        ) : (
          <DocumentPreview document={document} />
        )
      ) : (
        <Composer store={store} client={client} detail={detail} resumeId={resumeId} />
      )}
    </div>
  );
}
