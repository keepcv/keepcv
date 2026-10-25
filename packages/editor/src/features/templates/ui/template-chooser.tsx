import type { ResumeDocument, Store } from "@keepcv/schema";
import { useState } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { CheckboxField, TextField } from "../../../components/ui/field.js";
import { cn } from "../../../lib/cn.js";
import { PaperPreview } from "../../resumes/ui/paper-preview.js";
import { describeTemplate, previewWithTemplate } from "../model/preview.js";
import { SAMPLE_DOCUMENT } from "../model/sample.js";
import { type TemplateRow, templateRows } from "../model/template-rows.js";
import { TemplateData } from "./template-data.js";
import { TemplateThumbnail } from "./thumbnail.js";

function Choices({
  rows,
  selected,
  query,
  onSelect,
}: {
  rows: TemplateRow[];
  selected: string;
  query: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {[true, false].map((system) => {
        const choices = rows.filter(
          (row) =>
            row.isBuiltIn === system &&
            `${row.name} ${describeTemplate(row)}`.toLowerCase().includes(query.toLowerCase()),
        );
        return choices.length === 0 ? null : (
          <fieldset key={String(system)} className="space-y-2">
            <legend className="mb-2 text-xs font-semibold text-text-muted">
              {system ? "System templates" : "My templates"}
            </legend>
            {choices.map((row) => (
              <label
                key={row.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-surface-hover",
                  selected === row.id ? "border-brand bg-brand-soft" : "border-line",
                )}
              >
                <input
                  type="radio"
                  aria-label={row.name}
                  name="template-choice"
                  value={row.id}
                  checked={selected === row.id}
                  onChange={() => onSelect(row.id)}
                  className="accent-brand"
                />
                <TemplateThumbnail template={row.template} />
                <span className="min-w-0 text-sm text-text">
                  <span className="block font-medium">{row.name}</span>
                  <span className="text-xs text-text-subtle">
                    {describeTemplate(row)}
                    {row.isArchived ? " - Archived" : ""}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </>
  );
}

function Candidate({
  row,
  document,
}: {
  row: TemplateRow | undefined;
  document: ResumeDocument | undefined;
}) {
  if (row === undefined || document === undefined) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text">{row.name}</span>
        <Badge>{row.isBuiltIn ? "System - read-only" : "My template"}</Badge>
      </div>
      <PaperPreview document={document} />
      <details className="shrink-0 text-xs text-text-muted">
        <summary className="cursor-pointer">Available template data</summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <TemplateData document={document} />
        </div>
      </details>
    </>
  );
}

export function TemplateChooser({
  store,
  document,
  currentId,
  actionLabel,
  allowFitReset = false,
  onChoose,
  onClose,
}: {
  store: Store;
  document?: ResumeDocument;
  currentId: string | undefined;
  actionLabel: string;
  allowFitReset?: boolean;
  onChoose: (id: string, resetFit: boolean) => void;
  onClose: () => void;
}) {
  const rows = templateRows(store, "include").filter(
    (row) => !row.isArchived || row.id === currentId,
  );
  const [selected, setSelected] = useState(currentId ?? rows[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [resetFit, setResetFit] = useState(false);
  const [view, setView] = useState<"choices" | "preview">("choices");
  const chosen = rows.find((row) => row.id === selected);
  const shown =
    chosen === undefined
      ? undefined
      : previewWithTemplate(
          document ?? SAMPLE_DOCUMENT,
          chosen,
          allowFitReset && !resetFit ? (document?.meta.templateConfig ?? {}) : {},
        );

  return (
    <Dialog title="Choose a template" size="full" onClose={onClose}>
      <div className="@container flex min-h-0 flex-1 flex-col p-4">
        <fieldset aria-label="Chooser view" className="mb-3 flex shrink-0 gap-2 @3xl:hidden">
          <Button
            tone={view === "choices" ? "primary" : "secondary"}
            onClick={() => setView("choices")}
          >
            Templates
          </Button>
          <Button
            tone={view === "preview" ? "primary" : "secondary"}
            onClick={() => setView("preview")}
          >
            Preview
          </Button>
        </fieldset>
        <div className="grid min-h-0 min-w-0 flex-1 gap-5 @3xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div
            className={cn(
              "min-h-0 space-y-4 overflow-y-auto pr-1",
              view === "preview" && "hidden @3xl:block",
            )}
          >
            <TextField
              label="Find a template"
              value={query}
              onChange={setQuery}
              placeholder="Name, serif, compact..."
            />
            <Choices rows={rows} selected={selected} query={query} onSelect={setSelected} />
            {rows.some((row) =>
              `${row.name} ${describeTemplate(row)}`.toLowerCase().includes(query.toLowerCase()),
            ) ? null : (
              <p className="text-sm text-text-muted">No templates match that search.</p>
            )}
          </div>
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col gap-3",
              view === "choices" && "hidden @3xl:flex",
            )}
          >
            <Candidate row={chosen} document={shown} />
          </div>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          {allowFitReset ? (
            <CheckboxField
              label="Use template defaults"
              hint="Unchecked keeps this resume's current fit settings."
              checked={resetFit}
              onChange={setResetFit}
            />
          ) : (
            <p className="text-xs text-text-subtle">Previewing does not change any resume.</p>
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              tone="primary"
              disabled={
                chosen === undefined ||
                !chosen.template.documentVersions.includes(
                  (document ?? SAMPLE_DOCUMENT).schemaVersion,
                )
              }
              onClick={() => {
                if (chosen !== undefined) onChoose(chosen.id, resetFit);
              }}
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
