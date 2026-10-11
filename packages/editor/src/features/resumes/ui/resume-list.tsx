import { newUuid } from "@keepcv/core";
import type { Resume, Store } from "@keepcv/schema";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { Meta } from "../../../components/ui/meta.js";
import { NameBox } from "../../../components/ui/name-box.js";
import { PageBody, PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { counted } from "../../../lib/label.js";
import { pickableTemplates } from "../../templates/model/template-rows.js";
import { useCreateResume, useDeriveResume } from "../api/use-resumes.js";
import { type ResumeRow, resumeRows } from "../model/resume-rows.js";

function Derive({ resume, client }: { resume: Resume; client: ApiClient }) {
  const derive = useDeriveResume(client);
  const navigate = useNavigate();
  const [typed, setTyped] = useState<string | null>(null);

  if (typed === null) {
    return (
      <Button
        size="sm"
        icon="copy"
        label={`Start a resume from ${resume.name}`}
        onClick={() => {
          setTyped(`${resume.name} copy`);
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <NameBox
        label={`A name for the resume started from ${resume.name}`}
        initial={`${resume.name} copy`}
        confirm={derive.isPending ? "Copying" : "Create copy"}
        disabled={derive.isPending}
        onSave={(name) => {
          const id = newUuid();
          derive.mutate(
            { from: resume, id, name },
            {
              onSuccess: () => {
                void navigate({ to: "/resumes/$resumeId", params: { resumeId: id }, search: {} });
              },
            },
          );
        }}
        onCancel={() => {
          setTyped(null);
        }}
      />
      {derive.error === null ? null : <Failure error={derive.error} />}
    </div>
  );
}

function Row({
  row,
  resume,
  client,
}: {
  row: ResumeRow;
  resume: Resume | undefined;
  client: ApiClient;
}) {
  return (
    <li className="flex items-start gap-2 pr-2">
      <Link
        to="/resumes/$resumeId"
        params={{ resumeId: row.id }}
        className="block min-w-0 flex-1 rounded-lg px-3 py-2.5 hover:bg-surface-hover data-[archived=true]:opacity-60"
        data-archived={row.isArchived}
      >
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{row.name}</span>
          {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
          <span className="shrink-0 text-xs tabular-nums text-text-subtle">
            {row.applied === null ? "not sent" : `sent ${row.applied}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-text-subtle">
          {row.target ?? "No target role recorded"}
        </p>
        <Meta
          className="mt-1 text-xs tabular-nums text-text-subtle"
          parts={[
            counted(row.sections, "section", "sections"),
            counted(row.entries, "entry", "entries"),
            counted(row.points, "point", "points"),
            row.hidden === 0 ? null : `${String(row.hidden)} toggled off`,
            row.template,
          ]}
        />
      </Link>
      <span className="shrink-0 pt-2.5">
        {resume === undefined || row.isArchived ? null : <Derive resume={resume} client={client} />}
      </span>
    </li>
  );
}

function NewResume({
  client,
  store,
  template,
  onCancel,
}: {
  client: ApiClient;
  store: Store;
  template: string | undefined;
  onCancel: () => void;
}) {
  const create = useCreateResume(client);
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const templates = pickableTemplates(store, null);
  const [templateId, setTemplateId] = useState(
    templates.find((option) => option.id === template)?.id ?? templates[0]?.id ?? "",
  );

  const start = () => {
    const id = newUuid();
    create.mutate(
      {
        id,
        name: typed.trim(),
        targetCompany: null,
        targetRole: null,
        targetUrl: null,
        targetJdText: null,
        appliedOn: null,
        templateId: templateId || null,
        templateConfig: {},
        pageLimit: null,
      },
      {
        onSuccess: () => {
          void navigate({ to: "/resumes/$resumeId", params: { resumeId: id }, search: {} });
        },
      },
    );
  };

  return (
    <Panel>
      <PanelHeader title="New resume">
        Name it and choose a template. Next, add your content.
      </PanelHeader>
      <PanelBody>
        <form
          className="max-w-xl space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim() !== "" && !create.isPending) start();
          }}
        >
          <TextField
            label="Resume name"
            value={typed}
            placeholder="e.g. Backend engineer - Acme"
            onChange={setTyped}
          />
          <SelectField
            label="Template"
            value={templateId}
            onChange={setTemplateId}
            options={templates.map((option) => ({ value: option.id, label: option.name }))}
          />
          {create.error === null ? null : <Failure error={create.error} />}
          <div className="flex gap-2">
            <Button tone="primary" type="submit" disabled={typed.trim() === "" || create.isPending}>
              {create.isPending ? "Creating" : "Create resume"}
            </Button>
            <Button onClick={onCancel} disabled={create.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

export function ResumeList({
  store,
  client,
  archived,
  creating = false,
  template,
}: {
  store: Store;
  client: ApiClient;
  archived: ArchivedFilter;
  creating?: boolean;
  template?: string | undefined;
}) {
  const rows = resumeRows(store, archived);
  const navigate = useNavigate();

  return (
    <PageBody>
      <PageHeader
        title="Resumes"
        icon="resume"
        actions={
          creating ? null : (
            <Button
              tone="primary"
              icon="add"
              onClick={() => {
                void navigate({ to: "/resumes", search: { archived, create: true } });
              }}
            >
              New resume
            </Button>
          )
        }
      >
        Choose your content, pick a template, then preview and export.
      </PageHeader>

      {creating ? (
        <NewResume
          key={template ?? "new"}
          client={client}
          store={store}
          template={template}
          onCancel={() => {
            void navigate({ to: "/resumes", search: { archived } });
          }}
        />
      ) : null}

      <Toolbar count={counted(rows.length, "resume", "resumes")}>
        <Segmented label="Archived">
          {ARCHIVED_FILTERS.map((option) => (
            <Segment
              key={option}
              to="/resumes"
              search={{ archived: option }}
              active={archived === option}
            >
              {ARCHIVED_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty
          title={archived === "only" ? "Nothing archived here" : "No resumes yet"}
          spot={archived === "only" ? "permanent" : "compose"}
        >
          {archived === "only"
            ? "An archived resume keeps every version it ever had."
            : "Create a resume to choose from your career records. Your unused content stays available."}
        </Empty>
      ) : (
        <ul className="rounded-xl border border-line bg-surface p-1 shadow-card">
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              resume={store.resumes.find((held) => held.id === row.id)}
              client={client}
            />
          ))}
        </ul>
      )}
    </PageBody>
  );
}
