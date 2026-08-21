import type { Resume, Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { usePatchResume, useSetResumeArchived } from "../api/use-resumes.js";
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

function Rename({ resume, onRename }: { resume: Resume; onRename: (name: string) => void }) {
  const [typed, setTyped] = useState<string | null>(null);

  if (typed === null) {
    return (
      <button
        type="button"
        onClick={() => {
          setTyped(resume.name);
        }}
        className="text-xs text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
      >
        Rename
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label={`A name for ${resume.name}`}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
      />
      <Button
        tone="primary"
        disabled={typed.trim() === ""}
        onClick={() => {
          onRename(typed.trim());
          setTyped(null);
        }}
      >
        Save
      </Button>
      <Button
        onClick={() => {
          setTyped(null);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

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
  const patch = usePatchResume(client);
  const setArchived = useSetResumeArchived(client);

  if (detail === undefined) {
    return (
      <Empty title="No resume with that id">
        It may have been on another store, or the link may be older than the row. Every resume the
        store holds is on the resumes list.
      </Empty>
    );
  }

  const { header, resume, document } = detail;

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
          <Rename
            resume={resume}
            onRename={(name) => {
              patch.mutate({ resume, patch: { name } });
            }}
          />
          <Button
            onClick={() => {
              setArchived.mutate({ resume, archived: !header.isArchived });
            }}
          >
            {header.isArchived ? "Put this resume back" : "Archive this resume"}
          </Button>
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
          <DocumentPreview client={client} resume={resume} document={document} />
        )
      ) : (
        <Composer store={store} client={client} detail={detail} resumeId={resumeId} />
      )}
    </div>
  );
}
