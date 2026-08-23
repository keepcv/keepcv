import type { ResumeDocument, RichText } from "@keepcv/schema";
import { RESUME_DOCUMENT_SCHEMA_VERSION } from "@keepcv/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { configFor, type Template, type TemplateConfig } from "./contract.js";
import { FIXTURE_DOCUMENT } from "./fixture.js";

function markup(template: Template, config: TemplateConfig = template.defaultConfig): string {
  return renderToStaticMarkup(template.render(FIXTURE_DOCUMENT, config));
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// What a section printed: sections are siblings, so its subtree runs from the
// end of its opening tag to the next one.
function subtreeOf(html: string, key: string): string {
  const start = html.indexOf(`>`, html.indexOf(`data-key="${key}"`)) + 1;
  const next = html.indexOf('data-key="s', start);
  return html.slice(start, next === -1 ? undefined : next);
}

function textOf(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function keysOf(document: ResumeDocument): string[] {
  return document.sections.flatMap((section) => [
    section.key,
    ...section.entries.flatMap((entry) => [entry.key, ...entry.points.map((point) => point.key)]),
  ]);
}

function hrefsIn(nodes: RichText): string[] {
  return nodes.flatMap((node) =>
    node.t === "text" ? [] : node.t === "a" ? [node.href, ...hrefsIn(node.c)] : hrefsIn(node.c),
  );
}

function addressesOf(document: ResumeDocument): Set<string> {
  const { header } = document;
  return new Set([
    ...header.contacts.flatMap((contact) => (contact.href === undefined ? [] : [contact.href])),
    ...(header.summary === undefined ? [] : hrefsIn(header.summary)),
    ...document.sections.flatMap((section) =>
      section.entries.flatMap((entry) => [
        ...entry.links.map((link) => link.url),
        ...entry.fields.flatMap((field) => (field.kind === "url" ? [field.value] : [])),
        ...(entry.summary === undefined ? [] : hrefsIn(entry.summary)),
        ...entry.points.flatMap((point) => hrefsIn(point.text)),
      ]),
    ),
  ]);
}

function configsToTry(template: Template): TemplateConfig[] {
  return template.fields.flatMap((field) => {
    const values =
      field.kind === "choice"
        ? field.options.map((option) => option.value)
        : [field.min, field.max];
    return values.map((value) => ({ ...template.defaultConfig, [field.key]: value }));
  });
}

// Passing this is the definition of "is a template". It is called from a
// `describe` in the package's own suite and, once there is an exporter, from
// that one too.
export function isATemplate(template: Template): void {
  it("supports the document version this build compiles", () => {
    expect(template.documentVersions).toContain(RESUME_DOCUMENT_SCHEMA_VERSION);
  });

  it("prints every section, entry and point exactly once", () => {
    const html = markup(template);
    for (const key of keysOf(FIXTURE_DOCUMENT)) {
      expect(occurrences(html, `data-key="${key}"`), `key ${key}`).toBe(1);
    }
  });

  // A key that names two elements cannot answer "what put this on page two?".
  it("tags each element with a key that resolves to exactly one thing", () => {
    const keys = [...markup(template).matchAll(/data-key="([^"]*)"/g)].map((match) => match[1]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("says an empty section out loud instead of printing a heading over nothing", () => {
    const empty = FIXTURE_DOCUMENT.sections.find((section) => section.entries.length === 0);
    if (empty === undefined) throw new Error("the fixture holds a section with no entries");

    const printed = textOf(subtreeOf(markup(template), empty.key));
    expect(printed).toContain(empty.heading);
    expect(printed.replace(empty.heading, "").trim()).not.toBe("");
  });

  it("renders an entry of a kind no presenter in this build emits", () => {
    expect(markup(template)).toContain("Why &lt;script&gt; tags are not a resume format");
  });

  it("escapes what the store holds rather than trusting it", () => {
    expect(markup(template)).not.toContain("<script>");
  });

  it("links only to addresses the document carries", () => {
    const allowed = addressesOf(FIXTURE_DOCUMENT);
    const found = [...markup(template).matchAll(/href="([^"]*)"/g)].map((match) =>
      (match[1] ?? "").replaceAll("&amp;", "&"),
    );

    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((href) => !allowed.has(href))).toEqual([]);
  });

  it("ships a stylesheet that fetches nothing", () => {
    for (const config of [template.defaultConfig, ...configsToTry(template)]) {
      const css = template.styles(config);
      expect(css).not.toContain("@import");
      expect(css).not.toMatch(/url\((?!['"]?data:)/);
    }
  });

  // Without it the host cannot say how long the document is, because nothing
  // else in the stylesheet states the page box in a place CSS can resolve.
  it("states the height of one page's content", () => {
    for (const config of [template.defaultConfig, ...configsToTry(template)]) {
      expect(template.styles(config)).toMatch(/--kc-page-content-height:\s*[^;]+;/);
    }
  });

  it("renders at both ends of every value it offers", () => {
    for (const config of configsToTry(template)) {
      expect(markup(template, config).length).toBeGreaterThan(0);
      expect(template.styles(config).length).toBeGreaterThan(0);
    }
  });

  it("accepts the configuration it hands out", () => {
    expect(configFor(template, template.defaultConfig)).toEqual(template.defaultConfig);
  });
}
