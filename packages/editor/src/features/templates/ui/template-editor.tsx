import type { Store, Uuid } from "@keepcv/schema";
import { BLANK_SPEC } from "@keepcv/templates";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { ButtonLink } from "../../../components/ui/button.js";
import { PageHeader } from "../../../components/ui/page.js";
import type { ApiClient } from "../../../lib/api.js";
import { specOf } from "../model/preview.js";
import { templateRowFor } from "../model/template-rows.js";
import { BuilderPreview } from "./builder-preview.js";
import { TemplateBuilder } from "./template-builder.js";

export function NewTemplateScreen({
  store,
  client,
  basedOn,
  fromResume,
  importing = false,
}: {
  store: Store;
  client: ApiClient;
  basedOn?: string | undefined;
  fromResume?: Uuid | undefined;
  importing?: boolean;
}) {
  const source = basedOn === undefined ? undefined : templateRowFor(store, basedOn);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {source === undefined && !importing ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span>Template type: Default (visual)</span>
          <ButtonLink to="/templates/new" search={{ basedOn: "folio-html-v1", from: fromResume }}>
            Start an HTML template
          </ButtonLink>
        </div>
      ) : null}
      <TemplateBuilder
        key={`${basedOn ?? "blank"}:${fromResume ?? "library"}:${String(importing)}`}
        store={store}
        client={client}
        startingSpec={source === undefined ? BLANK_SPEC : specOf(source)}
        startingName={source === undefined ? "" : `${source.name} copy`}
        recoveryKey={`keepcv.template-new:${JSON.stringify([basedOn ?? "blank", fromResume ?? "library", importing])}`}
        fromResume={fromResume}
        importing={importing}
      />
    </div>
  );
}

export function TemplateEditorScreen({
  store,
  client,
  templateId,
  fromResume,
}: {
  store: Store;
  client: ApiClient;
  templateId: string;
  fromResume?: Uuid | undefined;
}) {
  const row = templateRowFor(store, templateId);
  if (row === undefined)
    return (
      <Empty title="Template not found" spot="noResults">
        Choose a template from the library or create your own.
      </Empty>
    );
  if (row.row !== undefined)
    return (
      <TemplateBuilder
        key={row.id}
        store={store}
        client={client}
        template={row.row}
        startingSpec={row.row.spec}
        recoveryKey={`keepcv.template-edit:${row.id}`}
        fromResume={fromResume}
      />
    );
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title={row.name}
        icon="template"
        trail={[{ label: "Templates", to: "/templates", search: { archived: "exclude" } }]}
        actions={
          <>
            <Badge>System - read-only</Badge>
            <ButtonLink to="/templates/new" search={{ basedOn: row.id, from: fromResume }}>
              Make a copy
            </ButtonLink>
            <ButtonLink
              tone="primary"
              to="/resumes"
              search={{ archived: "exclude", create: true, template: row.id }}
            >
              Create resume with this template
            </ButtonLink>
          </>
        }
      >
        This template belongs to the app. Make a copy to customize your own.
      </PageHeader>
      <div className="min-h-0 flex-1">
        <BuilderPreview
          store={store}
          id={row.id}
          name={row.name}
          spec={specOf(row)}
          sourceResumeId={fromResume}
        />
      </div>
      <details className="shrink-0 text-xs text-text-muted">
        <summary className="cursor-pointer">About this template</summary>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {row.template.complianceNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
