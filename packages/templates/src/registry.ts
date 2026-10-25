import type { ResumeDocument, StoredTemplate } from "@keepcv/schema";
import {
  atsLeftHeading,
  atsSingleColumn,
  classic,
  compact,
  editorial,
  leftHeadings,
  modern,
  singleColumn,
} from "./built-in.js";
import { configFor, type Template, type TemplateConfig } from "./contract.js";
import { HTML_TEMPLATES } from "./html/built-in.js";
import { fromDefinition, TEMPLATE_TYPES, type TemplateType } from "./types.js";

export const TEMPLATES: readonly Template[] = [
  singleColumn,
  leftHeadings,
  classic,
  modern,
  compact,
  editorial,
  ...HTML_TEMPLATES,
];

export const DEFAULT_TEMPLATE_ID = atsSingleColumn.id;

export function templateById(id: string | undefined): Template | undefined {
  return [...TEMPLATES, atsSingleColumn, atsLeftHeading].find((template) => template.id === id);
}

export function templateOf(
  row: StoredTemplate,
  types: readonly TemplateType[] = TEMPLATE_TYPES,
): Template {
  return fromDefinition(row.id, row.name, row.spec, types);
}

// Captured specs and legacy built-in ids must retain the design a version printed.
export function resolveTemplate(
  document: ResumeDocument,
  types: readonly TemplateType[] = TEMPLATE_TYPES,
): {
  template: Template;
  config: TemplateConfig;
} {
  const { templateId, templateName, templateSpec, templateConfig } = document.meta;
  const template =
    templateSpec === undefined
      ? (templateById(templateId) ?? atsSingleColumn)
      : fromDefinition(templateId ?? "custom", templateName ?? "Custom", templateSpec, types);

  return { template, config: configFor(template, templateConfig) };
}
