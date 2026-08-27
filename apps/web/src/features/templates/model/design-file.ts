import type { TemplateFile, TemplateSpec } from "@keepcv/schema";
import { templateFileSchema } from "@keepcv/schema";

const NOT_A_DESIGN = 'That is not a design. "Save it as a file" on a design writes one.';

export function designFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug === "" ? "design" : slug}.keepcv-template.json`;
}

export function designFile(name: string, spec: TemplateSpec): Blob {
  const contents: TemplateFile = { name, spec };
  return new Blob([`${JSON.stringify(contents, null, 2)}\n`], { type: "application/json" });
}

// Read in the tab, like a resume: a design is small and the store it is going
// into is the only thing that has to see it.
export function readDesign(body: string): { design: TemplateFile } | { problem: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { problem: NOT_A_DESIGN };
  }

  const read = templateFileSchema.safeParse(parsed);
  if (read.success) return { design: read.data };

  // The stylesheet refusals are the one failure worth quoting: a design edited
  // by hand trips them, and "not a design" would not say what to take out.
  const refused = read.error.issues.find((issue) => issue.code === "custom");
  return { problem: refused === undefined ? NOT_A_DESIGN : refused.message };
}
