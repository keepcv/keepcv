import type { ResumeDocument } from "@keepcv/schema";
import { atsSingleColumn } from "./ats-single-column/index.js";
import { configFor, type Template, type TemplateConfig } from "./contract.js";

export const TEMPLATES: readonly Template[] = [atsSingleColumn];

export const DEFAULT_TEMPLATE_ID = atsSingleColumn.id;

export function templateById(id: string | undefined): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

// A document names the template it was composed for. An id this build does not
// have - an older export, a template not installed - falls back rather than
// refusing to render, because a resume that will not print is the one thing this
// product may not produce.
export function resolveTemplate(document: ResumeDocument): {
  template: Template;
  config: TemplateConfig;
} {
  const template = templateById(document.meta.templateId) ?? atsSingleColumn;
  return { template, config: configFor(template, document.meta.templateConfig) };
}
