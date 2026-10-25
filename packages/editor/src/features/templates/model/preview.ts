import type { ResumeDocument, StoredTemplateSpec } from "@keepcv/schema";
import type { TemplateRow } from "./template-rows.js";

export function specOf(row: TemplateRow): StoredTemplateSpec {
  return (
    row.row?.spec ??
    row.template.definition ?? { settings: { ...row.template.defaultConfig }, extraCss: "" }
  );
}

export function previewWithTemplate(
  document: ResumeDocument,
  row: TemplateRow,
  config: Record<string, unknown> = {},
): ResumeDocument {
  return {
    ...document,
    meta: {
      ...document.meta,
      templateId: row.id,
      templateName: row.name,
      templateSpec: specOf(row),
      templateConfig: config,
    },
  };
}

export function describeTemplate(row: TemplateRow): string {
  if (row.template.type === "html") return "HTML - creative layout with editable source files";
  const config = row.template.defaultConfig;
  const serif = config["fontFamily"] === "georgia" || config["fontFamily"] === "times";
  const layout =
    config["headingPlace"] === "beside"
      ? "Side headings"
      : config["headerAlign"] === "centre"
        ? "Centered header"
        : "Single column";
  const density =
    typeof config["fontSize"] === "number" && config["fontSize"] < 10 ? ", compact spacing" : "";
  return `${layout}, ${serif ? "serif" : "sans-serif"}${density}`;
}
