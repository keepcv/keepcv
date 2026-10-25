import type { Resume, ResumeDocument, Store, Uuid } from "@keepcv/schema";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { NameBox } from "../../../components/ui/name-box.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { SaveState } from "../../../lib/save-state.js";
import { type ResumeSettings, useResumeSettings } from "../api/use-resume-settings.js";
import { usePatchResume, useSetResumeArchived } from "../api/use-resumes.js";
import { useCaptureVersion } from "../api/use-versions.js";
import { type ResumeDetail, resumeDetail } from "../model/resume-detail.js";
import { Composer } from "./composer.js";
import { DocumentPreview } from "./document-preview.js";
import { DownloadResume } from "./download.js";
import { PaperPreview } from "./paper-preview.js";
import { ResumeHistory } from "./resume-history.js";
import { TargetScreen } from "./target.js";

export const RESUME_VIEWS = ["composition", "preview", "target", "history"] as const;
export type ResumeView = (typeof RESUME_VIEWS)[number];
const VIEW_LABELS: Record<ResumeView, string> = {
  composition: "Content",
  preview: "Design",
  target: "Job target",
  history: "History",
};
const VIEW_ICONS = {
  composition: "variants",
  target: "match",
  preview: "template",
  history: "history",
} as const;

function Rename({ resume, onRename }: { resume: Resume; onRename: (name: string) => void }) {
  const [naming, setNaming] = useState(false);
  if (!naming)
    return (
      <Button
        tone="ghost"
        size="sm"
        icon="edit"
        label="Rename this resume"
        onClick={() => setNaming(true)}
      />
    );
  return (
    <NameBox
      label={`A name for ${resume.name}`}
      initial={resume.name}
      confirm="Save"
      onSave={(name) => {
        onRename(name);
        setNaming(false);
      }}
      onCancel={() => setNaming(false)}
    />
  );
}

function Workspace({
  store,
  client,
  detail,
  settings,
}: {
  store: Store;
  client: ApiClient;
  detail: ResumeDetail;
  settings: ResumeSettings;
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-5 @4xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="min-h-0 overflow-y-auto pr-1">
        <Composer store={store} client={client} detail={detail} resumeId={detail.resume.id} />
      </div>
      <div className="hidden min-h-0 @4xl:block">
        <PaperPreview document={settings.document} pageLimit={settings.resume.pageLimit} />
      </div>
    </div>
  );
}

function Chosen({
  store,
  client,
  detail,
  settings,
  view,
  suggestedTemplateId,
}: {
  store: Store;
  client: ApiClient;
  detail: ResumeDetail;
  settings: ResumeSettings;
  view: ResumeView;
  suggestedTemplateId?: string | undefined;
}) {
  switch (view) {
    case "history":
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ResumeHistory client={client} resumeId={detail.resume.id} />
        </div>
      );
    case "target":
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TargetScreen
            key={detail.resume.id}
            store={store}
            client={client}
            resume={detail.resume}
          />
        </div>
      );
    case "preview":
      return (
        <div className="min-h-0 flex-1">
          <DocumentPreview
            store={store}
            settings={settings}
            suggestedTemplateId={suggestedTemplateId}
          />
        </div>
      );
    case "composition":
      return <Workspace store={store} client={client} detail={detail} settings={settings} />;
  }
}

function ResumeWorkspace({
  store,
  client,
  detail,
  document,
  view,
  suggestedTemplateId,
}: {
  store: Store;
  client: ApiClient;
  detail: ResumeDetail;
  document: ResumeDocument;
  view: ResumeView;
  suggestedTemplateId?: string | undefined;
}) {
  const { header, resume } = detail;
  const settings = useResumeSettings(client, store, resume, document);
  const patch = usePatchResume(client);
  const archived = useSetResumeArchived(client);
  const capture = useCaptureVersion(client, resume.id, "export");
  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        title={header.name}
        trail={[{ label: "Resumes", to: "/resumes", search: { archived: "exclude" } }]}
        actions={
          <>
            <DownloadResume
              document={settings.document}
              beforeExport={settings.flush}
              onExport={(shown) => capture.mutateAsync(shown)}
            />
            <Rename
              resume={resume}
              onRename={(name) => patch.mutate({ resume, patch: { name } })}
            />
            <Button
              size="sm"
              icon={header.isArchived ? "restore" : "archive"}
              onClick={() => archived.mutate({ resume, archived: !header.isArchived })}
            >
              {header.isArchived ? "Restore" : "Archive"}
            </Button>
          </>
        }
      >
        {header.target ?? "Choose your content and design, then export your resume."}
        {header.applied === null ? "" : ` - sent ${header.applied}`}
      </PageHeader>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="View">
            {RESUME_VIEWS.map((option) => (
              <Segment
                key={option}
                to="/resumes/$resumeId"
                params={{ resumeId: resume.id }}
                search={{ view: option }}
                active={view === option}
                icon={VIEW_ICONS[option]}
              >
                {VIEW_LABELS[option]}
              </Segment>
            ))}
          </Segmented>
          {header.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        </div>
        <SaveState
          saving={settings.saving}
          pending={settings.pending !== null}
          error={settings.error}
          retry={settings.flush}
        />
      </div>
      {patch.error === null ? null : <Failure error={patch.error} />}
      {archived.error === null ? null : <Failure error={archived.error} />}
      {header.hidden === 0 ? null : (
        <p className="shrink-0 text-xs text-text-subtle">
          {String(header.hidden)} {header.hidden === 1 ? "item" : "items"} hidden from this resume
        </p>
      )}
      <Chosen
        store={store}
        client={client}
        detail={detail}
        settings={settings}
        view={view}
        suggestedTemplateId={suggestedTemplateId}
      />
    </div>
  );
}

export function ResumeDetailScreen({
  store,
  client,
  resumeId,
  view,
  asOf,
  suggestedTemplateId,
}: {
  store: Store;
  client: ApiClient;
  resumeId: Uuid;
  view: ResumeView;
  asOf: string;
  suggestedTemplateId?: string | undefined;
}) {
  const detail = resumeDetail(store, resumeId, asOf);
  if (detail === undefined)
    return (
      <Empty title="Resume not found" spot="noResults">
        Check the resumes list or return to the previous page.
      </Empty>
    );
  if (detail.document === undefined) return <Empty title="Nothing to compile yet" spot="compose" />;
  return (
    <ResumeWorkspace
      key={resumeId}
      store={store}
      client={client}
      detail={detail}
      document={detail.document}
      view={view}
      suggestedTemplateId={suggestedTemplateId}
    />
  );
}
