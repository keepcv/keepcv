import type { LengthBudget, Pagination } from "@keepcv/core";
import { compile, lengthBudget } from "@keepcv/core";
import type { Resume, ResumeDocument, ResumePatch, Store } from "@keepcv/schema";
import { resumePatchSchema, resumeSchema } from "@keepcv/schema";
import type { Template, TemplateConfig } from "@keepcv/templates";
import { resolveTemplate } from "@keepcv/templates";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useId, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/ui/field.js";
import type { ApiClient } from "../../../lib/api.js";
import { cn } from "../../../lib/cn.js";
import { SaveState } from "../../../lib/save-state.js";
import { STORE_KEY } from "../../../lib/store-cache.js";
import { useAutosave } from "../../../lib/use-autosave.js";
import { pickableTemplates } from "../../templates/model/template-rows.js";
import { Control } from "../../templates/ui/control.js";
import { usePatchResume } from "../api/use-resumes.js";
import { useCaptureVersion } from "../api/use-versions.js";
import { DownloadResume } from "./download.js";
import { LintPanel } from "./lint-report.js";
import { TemplateFrame } from "./template-frame.js";

const validSettings = () => true;
const readSettings = (value: unknown) => resumePatchSchema.safeParse(value).data ?? null;

function overrides(template: Template, config: TemplateConfig): TemplateConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([key, value]) => template.defaultConfig[key] !== value),
  );
}

const LIMITS = [
  { value: "", label: "No limit" },
  { value: "1", label: "One page" },
  { value: "2", label: "Two pages" },
  { value: "3", label: "Three pages" },
];

const NAMES_AT_MOST = 5;

const pages = (count: number) => `${String(count)} ${count === 1 ? "page" : "pages"}`;

function Budget({ budget }: { budget: LengthBudget }) {
  if (budget.limit === null) {
    return <p className="text-xs text-text-subtle">This is {pages(budget.pages)} long.</p>;
  }

  if (budget.fits) {
    return (
      <p className="text-xs text-positive-text">
        {pages(budget.pages)}, within the {pages(budget.limit)} you asked for.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-caution-text">
        {pages(budget.pages)}, which is {pages(budget.pages - budget.limit)} over.
      </p>
      {budget.over.length === 0 ? null : (
        <>
          <p className="text-xs text-text-subtle">Past the break:</p>
          <ul className="space-y-1 text-xs leading-relaxed text-text-muted">
            {budget.over.slice(0, NAMES_AT_MOST).map((piece) => (
              <li key={piece.key} className="line-clamp-2">
                <span className="text-text-subtle">{piece.kind}</span> {piece.label}
              </li>
            ))}
          </ul>
          {budget.over.length > NAMES_AT_MOST ? (
            <p className="text-xs text-text-subtle">
              and {String(budget.over.length - NAMES_AT_MOST)} more.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="space-y-2.5">
      <h3
        id={id}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-subtle"
      >
        {title}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </h3>
      {children}
    </section>
  );
}

export function DocumentPreview({
  store,
  client,
  resume,
  document,
  settings = true,
}: {
  store: Store;
  client: ApiClient;
  resume: Resume;
  document: ResumeDocument;
  settings?: boolean;
}) {
  const patch = usePatchResume(client);
  const capture = useCaptureVersion(client, resume.id, "export");
  const queries = useQueryClient();
  const autosave = useAutosave(
    `keepcv.resume-settings:${resume.id}`,
    readSettings,
    async (changes: ResumePatch) => {
      const current =
        queries.getQueryData<Store>(STORE_KEY)?.resumes.find((row) => row.id === resume.id) ??
        resume;
      await patch.mutateAsync({ resume: current, patch: changes });
    },
    validSettings,
  );
  const shownResume = resumeSchema.parse({ ...resume, ...autosave.pending });
  const shown =
    compile(
      { ...store, resumes: store.resumes.map((row) => (row.id === resume.id ? shownResume : row)) },
      resume.id,
      {
        generatedAt: document.meta.generatedAt,
        locale: document.meta.locale,
      },
    ) ?? document;
  const stored = resolveTemplate(shown);
  const [open, setOpen] = useState(settings);
  const [pagination, setPagination] = useState<Pagination>({ pages: 1, pageOf: {}, breaks: [] });
  const config = stored.config;
  const budget = lengthBudget(shown, pagination, shownResume.pageLimit);
  const onPaginate = useCallback((measured: Pagination) => {
    setPagination(measured);
  }, []);

  // Container queries: in half a workspace a 16rem sidebar off a viewport
  // breakpoint left the page 350px wide. A vertical scrollbar computes the
  // horizontal one to `auto`, hence `overflow-x-hidden`.
  return (
    <div className="@container flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden @3xl:overflow-y-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        {settings ? (
          <Button
            size="sm"
            icon="settings"
            iconEnd={open ? "chevronUp" : "chevronDown"}
            expanded={open}
            onClick={() => {
              setOpen(!open);
            }}
          >
            Export and settings
          </Button>
        ) : null}
        <p className="ml-auto text-xs tabular-nums text-text-subtle">{pages(budget.pages)}</p>
      </div>

      <div
        className={cn(
          "grid gap-6 @3xl:min-h-0 @3xl:flex-1",
          open && "@3xl:grid-cols-[16rem_minmax(0,1fr)]",
        )}
      >
        {open ? (
          // Before the paper, not after it: stacked the other way round in a
          // narrow pane, opening this appended it under a full-height resume
          // and changed nothing the reader could see.
          <aside className="space-y-5 @3xl:min-h-0 @3xl:overflow-y-auto @3xl:pr-2">
            <Group title="Take it with you">
              {store.drafts.some((draft) => draft.targetKind === "phrasing") ? (
                <p className="text-xs text-caution-text">
                  Unfinished wording drafts are not included in exports. Resume wording uses
                  committed revisions.
                </p>
              ) : null}
              <DownloadResume
                document={shown}
                onExport={async (exported) => {
                  if (!(await autosave.flush()))
                    throw new Error("The preview settings could not be saved.");
                  return await capture.mutateAsync(exported);
                }}
              />
            </Group>

            <Group title="How it reads">
              <LintPanel document={shown} />
              <SelectField
                label="How long it may be"
                options={LIMITS}
                value={shownResume.pageLimit === null ? "" : String(shownResume.pageLimit)}
                onChange={(chosen) => {
                  autosave.change({
                    ...autosave.pending,
                    pageLimit: chosen === "" ? null : Number(chosen),
                  });
                }}
              />
              <Budget budget={budget} />
            </Group>

            <Group title="How it looks">
              <SelectField
                label="Template"
                options={pickableTemplates(store, stored.template.id).map((option) => ({
                  value: option.id,
                  label: option.name,
                }))}
                value={stored.template.id}
                onChange={(templateId) => {
                  autosave.change({ ...autosave.pending, templateId, templateConfig: {} });
                }}
              />
              {store.templates.some((row) => row.id === stored.template.id) ? (
                <Link
                  to="/templates/$templateId"
                  params={{ templateId: stored.template.id }}
                  className="inline-flex items-center gap-1 text-xs text-text-muted underline-offset-2 hover:text-text hover:underline"
                >
                  Change what this design is
                </Link>
              ) : null}
              {stored.template.fields.map((field) => (
                <Control
                  key={field.key}
                  field={field}
                  config={config}
                  onChange={(value) => {
                    autosave.change({
                      ...autosave.pending,
                      templateId: stored.template.id,
                      templateConfig: overrides(stored.template, { ...config, [field.key]: value }),
                    });
                  }}
                />
              ))}
              <SaveState
                saving={autosave.saving}
                pending={autosave.pending !== null}
                error={autosave.error}
                retry={autosave.flush}
              />
              <ul className="space-y-1 text-xs leading-relaxed text-text-subtle">
                {stored.template.complianceNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Group>
          </aside>
        ) : null}

        <div className="@3xl:min-h-0 @3xl:overflow-y-auto">
          <div className="rounded-xl bg-paper p-4">
            <TemplateFrame
              title={`${resume.name}, as it prints`}
              styles={stored.template.styles(config)}
              overflowsFrom={shownResume.pageLimit ?? undefined}
              onPaginate={onPaginate}
            >
              {stored.template.render(shown, config)}
            </TemplateFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
