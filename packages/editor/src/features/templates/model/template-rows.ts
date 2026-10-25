import { resumesUsingTemplate } from "@keepcv/core";
import type { Store, StoredTemplate } from "@keepcv/schema";
import type { Template } from "@keepcv/templates";
import { definitionOf, TEMPLATES, templateById, templateOf } from "@keepcv/templates";
import type { ArchivedFilter } from "../../../lib/archived.js";

export interface TemplateRow {
  id: string;
  name: string;
  isBuiltIn: boolean;
  isArchived: boolean;
  usedBy: number;
  template: Template;
  row: StoredTemplate | undefined;
}

export function availableTemplate(row: StoredTemplate): Template {
  try {
    return templateOf(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Template unavailable.";
    return {
      id: row.id,
      name: row.name,
      type: definitionOf(row.spec).type,
      definition: definitionOf(row.spec),
      version: String(definitionOf(row.spec).version),
      documentVersions: [],
      fields: [],
      defaultConfig: {},
      complianceNotes: [message],
      styles: () => "",
      render: () => {
        throw new Error(message);
      },
    };
  }
}

function usedBy(store: Store, id: string): number {
  return resumesUsingTemplate(store, id).length;
}

export function templateRows(store: Store, archived: ArchivedFilter): TemplateRow[] {
  const legacy = store.resumes.flatMap((resume) => {
    const template = templateById(resume.templateId ?? undefined);
    return template === undefined || TEMPLATES.some((row) => row.id === template.id)
      ? []
      : [template];
  });
  const designs = [
    ...new Map([...TEMPLATES, ...legacy].map((template) => [template.id, template])).values(),
  ];
  const built = designs.map((template) => ({
    id: template.id,
    name: TEMPLATES.includes(template) ? template.name : `${template.name} (original)`,
    isBuiltIn: true,
    isArchived: false,
    usedBy: usedBy(store, template.id),
    template,
    row: undefined,
  }));

  const mine = store.templates
    .filter((row) =>
      archived === "only"
        ? row.archivedAt !== null
        : archived === "include" || row.archivedAt === null,
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      isBuiltIn: false,
      isArchived: row.archivedAt !== null,
      usedBy: usedBy(store, row.id),
      template: availableTemplate(row),
      row,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return archived === "only" ? mine : [...built, ...mine];
}

export function templateNamed(store: Store, id: string | null): string | undefined {
  return templateRows(store, "include").find((row) => row.id === id)?.name;
}

export function templateRowFor(store: Store, id: string): TemplateRow | undefined {
  const row = templateRows(store, "include").find((row) => row.id === id);
  if (row !== undefined) return row;
  const template = templateById(id);
  return template === undefined
    ? undefined
    : {
        id,
        name: `${template.name} (original)`,
        isBuiltIn: true,
        isArchived: false,
        usedBy: usedBy(store, id),
        template,
        row: undefined,
      };
}
