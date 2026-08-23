import type { Resume, Store, Uuid } from "@keepcv/schema";
import { useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { NameBox } from "../../../components/ui/name-box.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { usePatchResume, useSetResumeArchived } from "../api/use-resumes.js";
import { type ResumeDetail, resumeDetail } from "../model/resume-detail.js";
import { Composer } from "./composer.js";
import { DocumentPreview } from "./document-preview.js";
import { ResumeHistory } from "./resume-history.js";
import { TargetScreen } from "./target.js";

export const RESUME_VIEWS = ["composition", "target", "preview", "history"] as const;

export type ResumeView = (typeof RESUME_VIEWS)[number];

const VIEW_LABELS: Record<ResumeView, string> = {
  composition: "Composition",
  target: "Target",
  preview: "Preview",
  history: "History",
};

const VIEW_ICONS = {
  composition: "variants",
  target: "match",
  preview: "resume",
  history: "history",
} as const;

function Rename({ resume, onRename }: { resume: Resume; onRename: (name: string) => void }) {
  const [naming, setNaming] = useState(false);

  if (!naming) {
    return (
      <Button
        tone="ghost"
        size="sm"
        icon="edit"
        label="Rename this resume"
        onClick={() => {
          setNaming(true);
        }}
      />
    );
  }

  return (
    <NameBox
      label={`A name for ${resume.name}`}
      initial={resume.name}
      confirm="Save"
      onSave={(name) => {
        onRename(name);
        setNaming(false);
      }}
      onCancel={() => {
        setNaming(false);
      }}
    />
  );
}

// Composition and preview are one workspace: the selection on the left, what it
// compiles to on the right, each scrolling on its own. Below `xl` there is not
// room for two, and the preview has its own view.
function Workspace({
  store,
  client,
  detail,
}: {
  store: Store;
  client: ApiClient;
  detail: ResumeDetail;
}) {
  const { resume, document } = detail;

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-h-0 overflow-y-auto pr-1">
        <Composer store={store} client={client} detail={detail} resumeId={resume.id} />
      </div>
      <div className="hidden min-h-0 xl:block">
        {document === undefined ? (
          <Empty title="Nothing to compile yet" spot="compose" />
        ) : (
          <DocumentPreview client={client} resume={resume} document={document} settings={false} />
        )}
      </div>
    </div>
  );
}

function Chosen({
  store,
  client,
  detail,
  view,
}: {
  store: Store;
  client: ApiClient;
  detail: ResumeDetail;
  view: ResumeView;
}) {
  const { resume, document } = detail;

  switch (view) {
    case "history":
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ResumeHistory client={client} resumeId={resume.id} />
        </div>
      );
    case "target":
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TargetScreen store={store} client={client} resume={resume} />
        </div>
      );
    case "preview":
      return (
        <div className="min-h-0 flex-1">
          {document === undefined ? (
            <Empty title="Nothing to compile yet" spot="compose" />
          ) : (
            <DocumentPreview client={client} resume={resume} document={document} />
          )}
        </div>
      );
    case "composition":
      return <Workspace store={store} client={client} detail={detail} />;
  }
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
      <Empty title="No resume with that id" spot="noResults">
        It may have been on another store, or the link may be older than the row. Every resume the
        store holds is on the resumes list.
      </Empty>
    );
  }

  const { header, resume } = detail;

  // Full height with the panes scrolling on their own: a preview that scrolls
  // the page away from the control that changed it is a preview nobody watches.
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title={header.name}
        trail={[{ label: "Resumes", to: "/resumes", search: { archived: "exclude" } }]}
        actions={
          <>
            <Rename
              resume={resume}
              onRename={(name) => {
                patch.mutate({ resume, patch: { name } });
              }}
            />
            <Button
              icon={header.isArchived ? "restore" : "archive"}
              onClick={() => {
                setArchived.mutate({ resume, archived: !header.isArchived });
              }}
            >
              {header.isArchived ? "Put back" : "Archive"}
            </Button>
          </>
        }
      >
        {header.target ?? "No target role recorded"}
        {header.applied === null ? "" : ` - sent ${header.applied}`}
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="View">
            {RESUME_VIEWS.map((option) => (
              <Segment
                key={option}
                to="/resumes/$resumeId"
                params={{ resumeId }}
                search={{ view: option }}
                active={view === option}
                icon={VIEW_ICONS[option]}
              >
                {VIEW_LABELS[option]}
              </Segment>
            ))}
          </Segmented>
          {header.isArchived ? (
            <Badge tone="warning" icon="archive">
              Archived, and kept
            </Badge>
          ) : null}
        </div>
        <p className="text-xs tabular-nums text-text-subtle">
          {header.hidden === 0
            ? "Everything placed prints."
            : `${String(header.hidden)} placed and toggled off, kept either way.`}
        </p>
      </div>

      <Chosen store={store} client={client} detail={detail} view={view} />
    </div>
  );
}
