import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHtml } from "../../../packages/render/dist/index.js";
import { resumeDocumentSchema } from "../../../packages/schema/dist/index.js";
import { HTML_TEMPLATES, validateTemplate } from "../../../packages/templates/dist/index.js";

const directory = fileURLToPath(new URL("./", import.meta.url));
const output = resolve(directory, "../../../.keepcv-html-template-research/rendered");
const sample = resumeDocumentSchema.parse(
  JSON.parse(await readFile(resolve(directory, "sample-resume.json"), "utf8")),
);
await mkdir(output, { recursive: true });
for (const template of HTML_TEMPLATES) {
  assert(template.definition);
  validateTemplate(template.definition);
  const document = { ...sample, meta: { ...sample.meta, templateId: template.id } };
  const html = renderHtml(document);
  for (const section of sample.sections) {
    assert(html.includes(`data-key="${section.key}"`));
    for (const entry of section.entries) {
      assert(html.includes(`data-key="${entry.key}"`));
      for (const point of entry.points) assert(html.includes(`data-key="${point.key}"`));
    }
  }
  await writeFile(resolve(output, `${template.name.toLowerCase()}.html`), html);
  await writeFile(
    resolve(output, `${template.name.toLowerCase()}.template.json`),
    `${JSON.stringify({ name: template.name, spec: template.definition }, null, 2)}\n`,
  );
  process.stdout.write(`${template.name}: exported through the application renderer\n`);
}
const links = HTML_TEMPLATES.map(
  (template) =>
    `<p><a href="${template.name.toLowerCase()}.html">${template.name}</a> - <a href="${template.name.toLowerCase()}.template.json">Template source</a></p>`,
).join("\n");
await writeFile(
  resolve(output, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>KeepCV HTML templates</title><body><h1>HTML templates</h1>${links}</body></html>\n`,
);
