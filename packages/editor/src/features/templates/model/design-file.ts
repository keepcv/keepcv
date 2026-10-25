import type { StoredTemplateSpec, TemplateFile } from "@keepcv/schema";
import { templateFileSchema } from "@keepcv/schema";

const NOT_A_DESIGN = 'That is not a template. "Download template file" in the builder writes one.';

export function designFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug === "" ? "design" : slug}.keepcv-template.json`;
}

export function designFile(name: string, spec: StoredTemplateSpec): Blob {
  const contents: TemplateFile = { name, spec };
  return new Blob([`${JSON.stringify(contents, null, 2)}\n`], { type: "application/json" });
}

export function readDesign(body: string): { design: TemplateFile } | { problem: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { problem: NOT_A_DESIGN };
  }

  const read = templateFileSchema.safeParse(parsed);
  if (read.success) return { design: read.data };

  const refused = read.error.issues.find((issue) => issue.code === "custom");
  return { problem: refused === undefined ? NOT_A_DESIGN : refused.message };
}
