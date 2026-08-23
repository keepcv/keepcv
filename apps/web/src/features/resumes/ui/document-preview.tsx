import type { LengthBudget, Pagination } from "@keepcv/core";
import { lengthBudget } from "@keepcv/core";
import type { Resume, ResumeDocument } from "@keepcv/schema";
import type { ConfigField, Template, TemplateConfig } from "@keepcv/templates";
import { resolveTemplate, TEMPLATES } from "@keepcv/templates";
import { useCallback, useEffect, useState } from "react";
import { RangeField, SelectField } from "../../../components/ui/field.js";
import type { ApiClient } from "../../../lib/api.js";
import { usePatchResume } from "../api/use-resumes.js";
import { DownloadResume } from "./download.js";
import { LintPanel } from "./lint-report.js";
import { TemplateFrame } from "./template-frame.js";

// Long enough that dragging a slider is one write rather than forty. Each one
// carries the row's `updatedAt`, and a burst would race its own answers.
const SETTLES_AFTER = 500;

// Only what differs from the template's own defaults, so a default that moves
// in a later version moves with it.
function overrides(template: Template, config: TemplateConfig): TemplateConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([key, value]) => template.defaultConfig[key] !== value),
  );
}

function Control({
  field,
  config,
  onChange,
}: {
  field: ConfigField;
  config: TemplateConfig;
  onChange: (value: string | number) => void;
}) {
  const value = config[field.key];

  if (field.kind === "choice") {
    return (
      <SelectField
        label={field.label}
        options={field.options}
        value={typeof value === "string" ? value : field.default}
        onChange={onChange}
      />
    );
  }

  return (
    <RangeField
      label={field.label}
      min={field.min}
      max={field.max}
      step={field.step}
      unit={field.unit}
      value={typeof value === "number" ? value : field.default}
      onChange={onChange}
    />
  );
}

const LIMITS = [
  { value: "", label: "No limit" },
  { value: "1", label: "One page" },
  { value: "2", label: "Two pages" },
  { value: "3", label: "Three pages" },
];

// Enough to act on. The whole tail of a long resume is over the limit, and
// listing it would push the template's own settings off the screen.
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

export function DocumentPreview({
  client,
  resume,
  document,
}: {
  client: ApiClient;
  resume: Resume;
  document: ResumeDocument;
}) {
  const stored = resolveTemplate(document);
  const patch = usePatchResume(client);
  const [pending, setPending] = useState<TemplateConfig | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ pages: 1, pageOf: {}, breaks: [] });
  const config = pending ?? stored.config;
  const { mutate } = patch;
  const budget = lengthBudget(document, pagination, resume.pageLimit);
  const onPaginate = useCallback((measured: Pagination) => {
    setPagination(measured);
  }, []);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      mutate({
        resume,
        patch: {
          templateId: stored.template.id,
          templateConfig: overrides(stored.template, pending),
        },
      });
      setPending(null);
    }, SETTLES_AFTER);

    return () => {
      clearTimeout(timer);
    };
  }, [pending, resume, stored.template, mutate]);

  // Keyed to this pane rather than the viewport: it renders both full width on
  // its own tab and in half a workspace, and a 15rem sidebar off a viewport
  // breakpoint left the page about 350px wide there.
  return (
    <div className="@container">
      <div className="grid gap-6 @3xl:grid-cols-[15rem_minmax(0,1fr)] @3xl:items-start">
        <aside className="order-2 space-y-4 @3xl:order-1">
          <DownloadResume document={document} />

          <LintPanel document={document} />

          <div className="space-y-2 rounded-lg bg-surface-sunken p-3">
            <SelectField
              label="How long it may be"
              options={LIMITS}
              value={resume.pageLimit === null ? "" : String(resume.pageLimit)}
              onChange={(chosen) => {
                mutate({ resume, patch: { pageLimit: chosen === "" ? null : Number(chosen) } });
              }}
            />
            <Budget budget={budget} />
          </div>

          <SelectField
            label="Template"
            options={TEMPLATES.map((option) => ({ value: option.id, label: option.name }))}
            value={stored.template.id}
            onChange={(templateId) => {
              setPending(null);
              mutate({ resume, patch: { templateId, templateConfig: {} } });
            }}
          />

          {stored.template.fields.map((field) => (
            <Control
              key={field.key}
              field={field}
              config={config}
              onChange={(value) => {
                setPending({ ...config, [field.key]: value });
              }}
            />
          ))}

          <div className="rounded-lg bg-surface-sunken p-3">
            <h3 className="text-xs font-medium text-text-muted">What this template does</h3>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-text-subtle">
              {stored.template.complianceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="order-1 rounded-xl bg-paper p-4 @3xl:order-2">
          <TemplateFrame
            title={`${resume.name}, as it prints`}
            styles={stored.template.styles(config)}
            overflowsFrom={resume.pageLimit ?? undefined}
            onPaginate={onPaginate}
          >
            {stored.template.render(document, config)}
          </TemplateFrame>
        </div>
      </div>
    </div>
  );
}
