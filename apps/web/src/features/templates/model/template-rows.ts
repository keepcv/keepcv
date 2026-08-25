import type { Store, StoredTemplate } from "@keepcv/schema";
import type { Template } from "@keepcv/templates";
import { TEMPLATES, templateOf } from "@keepcv/templates";
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

function usedBy(store: Store, id: string): number {
  return store.resumes.filter((resume) => resume.templateId === id && resume.archivedAt === null)
    .length;
}

// Built-in first and always: they are in every build, so a store with no
// templates of its own still has something for a resume to name.
export function templateRows(store: Store, archived: ArchivedFilter): TemplateRow[] {
  const built = TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
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
      template: templateOf(row),
      row,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return archived === "only" ? mine : [...built, ...mine];
}

// What a resume may name. An archived design is offered nowhere, but a resume
// already naming one goes on printing with it.
export function pickableTemplates(store: Store): { id: string; name: string }[] {
  return templateRows(store, "exclude").map(({ id, name }) => ({ id, name }));
}

export function templateNamed(store: Store, id: string | null): string | undefined {
  return templateRows(store, "include").find((row) => row.id === id)?.name;
}
