import type { ResumeDocument, StoredTemplate } from "@keepcv/schema";
import { atsLeftHeading, atsSingleColumn } from "./built-in.js";
import { configFor, type Template, type TemplateConfig } from "./contract.js";
import { fromSpec } from "./from-spec.js";

export const TEMPLATES: readonly Template[] = [atsSingleColumn, atsLeftHeading];

export const DEFAULT_TEMPLATE_ID = atsSingleColumn.id;

export function templateById(id: string | undefined): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function templateOf(row: StoredTemplate): Template {
  return fromSpec(row.id, row.name, row.spec);
}

// A document names the template it was composed for, and carries the whole
// design when that template is one the user wrote - editing the row later must
// not change what an already-captured version says it printed. An id this build
// does not have falls back rather than refusing to render, because a resume that
// will not print is the one thing this product may not produce.
export function resolveTemplate(document: ResumeDocument): {
  template: Template;
  config: TemplateConfig;
} {
  const { templateId, templateName, templateSpec, templateConfig } = document.meta;
  const template =
    templateSpec === undefined
      ? (templateById(templateId) ?? atsSingleColumn)
      : fromSpec(templateId ?? "custom", templateName ?? "Custom", templateSpec);

  return { template, config: configFor(template, templateConfig) };
}
