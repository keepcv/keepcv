import type { LengthBudget, Pagination } from "@keepcv/core";
import { lengthBudget } from "@keepcv/core";
import type { Resume, ResumeDocument } from "@keepcv/schema";
import type { ConfigField, Template, TemplateConfig } from "@keepcv/templates";
import { resolveTemplate, TEMPLATES } from "@keepcv/templates";
import { type ReactNode, useCallback, useEffect, useId, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { RangeField, SelectField } from "../../../components/ui/field.js";
import type { ApiClient } from "../../../lib/api.js";
import { cn } from "../../../lib/cn.js";
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
  client,
  resume,
  document,
  settings = true,
}: {
  client: ApiClient;
  resume: Resume;
  document: ResumeDocument;
  // Off beside the composition, where this is live feedback on what was just
  // placed and a panel of export and template controls would cover the thing it
  // changes. They belong to the preview's own tab, which is one click away.
  settings?: boolean;
}) {
  const stored = resolveTemplate(document);
  const patch = usePatchResume(client);
  const [open, setOpen] = useState(settings);
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

  // Every breakpoint here is a container query: this renders full width on its
  // own tab and in half a workspace, and a 16rem sidebar off a viewport
  // breakpoint left the page about 350px wide in the second. Wide enough for two
  // columns, each scrolls on its own, so reading down the resume does not carry
  // the settings off the top. `overflow-x-hidden` because a vertical scrollbar
  // makes the horizontal one compute to `auto` too, and the 16px it reserves is
  // enough to show it.
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
          // narrow pane, opening this appended it under a full-height resume and
          // changed nothing the reader could see.
          <aside className="space-y-5 @3xl:min-h-0 @3xl:overflow-y-auto @3xl:pr-2">
            <Group title="Take it with you">
              <DownloadResume document={document} />
            </Group>

            <Group title="How it reads">
              <LintPanel document={document} />
              <SelectField
                label="How long it may be"
                options={LIMITS}
                value={resume.pageLimit === null ? "" : String(resume.pageLimit)}
                onChange={(chosen) => {
                  mutate({ resume, patch: { pageLimit: chosen === "" ? null : Number(chosen) } });
                }}
              />
              <Budget budget={budget} />
            </Group>

            <Group title="How it looks">
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
              overflowsFrom={resume.pageLimit ?? undefined}
              onPaginate={onPaginate}
            >
              {stored.template.render(document, config)}
            </TemplateFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
