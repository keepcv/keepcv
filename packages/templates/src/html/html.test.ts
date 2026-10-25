import type { HtmlTemplatePayload, ResumeDocument, StoredTemplateSpec } from "@keepcv/schema";
import { htmlTemplatePayloadSchema } from "@keepcv/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIXTURE_DOCUMENT } from "../fixture.js";
import { fromDefinition, validateTemplate } from "../types.js";
import { HTML_TEMPLATES } from "./built-in.js";
import { HtmlTemplateError } from "./error.js";
import { htmlScope, renderHtmlBody, validateHtmlTemplate } from "./template.js";

function payload(source: string, css = ""): HtmlTemplatePayload {
  return htmlTemplatePayloadSchema.parse({
    documentVersions: [1],
    entry: "index.html",
    styles: ["theme.css"],
    page: { size: "a4", marginMm: 14 },
    files: {
      "index.html": { mediaType: "text/html", encoding: "utf8", content: source },
      "theme.css": { mediaType: "text/css", encoding: "utf8", content: css },
    },
  });
}

function code(run: () => unknown, expected: string) {
  try {
    run();
    throw new Error("Expected a template refusal");
  } catch (error) {
    expect(error).toBeInstanceOf(HtmlTemplateError);
    expect((error as HtmlTemplateError).code).toBe(expected);
  }
}

describe("authored HTML", () => {
  it("bounds string-only work without requiring output", () => {
    const doc = structuredClone(FIXTURE_DOCUMENT);
    doc.header.fullName = "a".repeat(800_000);
    doc.sections = Array.from({ length: 20 }, () => FIXTURE_DOCUMENT.sections[0]).filter(
      (section) => section !== undefined,
    );
    code(
      () =>
        renderHtmlBody(
          payload(
            "{% for section in resume.sections %}{% assign upper = resume.header.fullName | upcase %}{% endfor %}",
          ),
          doc,
          {},
        ),
      "binding-budget",
    );
  });

  it("renders validated bundled images and rejects MIME/path substitutions", () => {
    const source = payload('<img src="assets/pixel.png" alt="Decoration">');
    source.files["assets/pixel.png"] = {
      mediaType: "image/png",
      encoding: "base64",
      content:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6KxsAAAAASUVORK5CYII=",
    };
    validateHtmlTemplate(source);
    expect(renderHtmlBody(source, FIXTURE_DOCUMENT, {})).toContain("data:image/png;base64,");
    const image = source.files["assets/pixel.png"];
    image.mediaType = "font/woff2";
    code(() => validateHtmlTemplate(source), "invalid-asset");
  });

  it("preserves all selected keys for reversed and sparse sample documents", () => {
    const doc = structuredClone(FIXTURE_DOCUMENT);
    doc.sections.reverse();
    doc.header = { contacts: [] };
    for (const template of HTML_TEMPLATES) {
      const html = renderToStaticMarkup(template.render(doc, template.defaultConfig));
      const positions = doc.sections.map((section) => html.indexOf(`data-key="${section.key}"`));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      for (const section of doc.sections)
        expect(html.split(`data-key="${section.key}"`)).toHaveLength(2);
    }
  });

  it.each(HTML_TEMPLATES)(
    "renders $name with all selected content and bounded creative CSS",
    (template) => {
      const definition = template.definition;
      if (definition === undefined) throw new Error("Sample has a definition");
      validateTemplate(definition);
      const html = renderToStaticMarkup(template.render(FIXTURE_DOCUMENT, template.defaultConfig));
      for (const section of FIXTURE_DOCUMENT.sections) {
        expect(html).toContain(`data-key="${section.key}"`);
        for (const entry of section.entries) {
          expect(html).toContain(`data-key="${entry.key}"`);
          for (const point of entry.points) expect(html).toContain(`data-key="${point.key}"`);
        }
      }
      expect(html).toContain("<strong>");
      expect(template.styles(template.defaultConfig)).toContain("@page{size:a4");
      if (template.name === "Signal")
        expect(template.styles(template.defaultConfig)).toContain("rotate(");
    },
  );

  it("binds data once, escapes text, preserves order and resolves optional fields", () => {
    const doc = structuredClone(FIXTURE_DOCUMENT);
    doc.header.fullName = '<img onerror="alert(1)"> {{ secrets }}';
    const source =
      '{{ resume.header.fullName }}{% if resume.header.missing %}BAD{% endif %}{{ resume.header.missing | default: "OK" }}{% for section in resume.sections %}<h2>{{ section.heading }}</h2>{% endfor %}';
    const html = renderHtmlBody(payload(source), doc, {});
    expect(html).toMatch(/(?:&lt;|&#x3C;)img/);
    expect(html).not.toContain("<img");
    expect(html).toContain("{{ secrets }}");
    expect(html).toContain("OK");
    expect(html).not.toContain("BAD");
    const positions = doc.sections.map((section) => html.indexOf(section.heading));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("provides only selected presentation data, without template source or privileged objects", () => {
    const doc: ResumeDocument = {
      ...FIXTURE_DOCUMENT,
      meta: {
        ...FIXTURE_DOCUMENT.meta,
        templateSpec: { settings: {}, extraCss: "PRIVATE_SOURCE" },
        templateConfig: { secret: "PRIVATE_SETTING" },
      },
    };
    const scope = JSON.stringify(htmlScope(doc, { size: "a4", marginMm: 14 }));
    expect(scope).not.toContain("PRIVATE_SOURCE");
    expect(scope).not.toContain("PRIVATE_SETTING");
    for (const path of [
      "store.profile",
      "process.env",
      "window.localStorage",
      "resume.meta.templateSpec",
      "resume.evidence",
    ])
      code(() => renderHtmlBody(payload(`{{ ${path} }}`), doc, {}), "missing-field");
  });

  it.each([
    "resume.constructor",
    "resume.__proto__",
    "resume.header.toString",
    "resume.header.valueOf",
  ])("refuses runtime path %s", (path) => {
    code(() => validateHtmlTemplate(payload(`{{ ${path} }}`)), "unsafe-binding");
  });

  it.each([
    "{{ 1 | valueOf }}",
    "{{ resume | inspect }}",
    "{{ resume.header.fullName | raw }}",
    "{% include 'x' %}",
    "{% for i in (1..1000000) %}{% endfor %}",
  ])("refuses unsupported execution syntax: %s", (source) => {
    expect(() => validateHtmlTemplate(payload(source))).toThrow(HtmlTemplateError);
  });

  it("rejects missing, dynamic, recursive and cyclic partial references", () => {
    code(() => validateHtmlTemplate(payload("{% render 'missing.html' %}")), "missing-partial");
    code(
      () => validateHtmlTemplate(payload("{% render resume.header.fullName %}")),
      "binding-syntax",
    );
    code(() => validateHtmlTemplate(payload("{% render 'index.html' %}")), "partial-cycle");
    const source = payload("{% render 'child.html' %}");
    source.files["child.html"] = {
      mediaType: "text/html",
      encoding: "utf8",
      content: "{% render 'index.html' %}",
    };
    code(() => validateHtmlTemplate(source), "partial-cycle");
  });

  it("bounds work even when a nested loop emits no content", () => {
    const doc = structuredClone(FIXTURE_DOCUMENT);
    doc.sections = Array.from({ length: 400 }, () => doc.sections[0]).filter(
      (section) => section !== undefined,
    );
    code(
      () =>
        renderHtmlBody(
          payload(
            "{% for a in resume.sections %}{% for b in resume.sections %}{% endfor %}{% endfor %}",
          ),
          doc,
          {},
        ),
      "binding-budget",
    );
  });

  it.each([
    "<script>alert(1)</script>",
    '<img src="x" onerror="alert(1)" alt="">',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<iframe src="https://example.com"></iframe>',
    '<meta http-equiv="refresh" content="0">',
    '<form action="https://example.com"><input name="x"></form>',
    '<img src="https://example.com/x" alt="">',
    "<svg><foreignObject>x</foreignObject></svg>",
    '<a href="https://example.com" ping="https://example.com/log">x</a>',
    '<link rel="prefetch" href="https://example.com">',
    '<a href="data:text/html,x">x</a>',
  ])("refuses active or fetching markup: %s", (source) => {
    expect(() => renderHtmlBody(payload(source), FIXTURE_DOCUMENT, {})).toThrow(HtmlTemplateError);
  });

  it.each([
    '@import "https://example.com/x.css";',
    ".x{background:url(https://example.com/x)}",
    ".x{cursor:url(https://example.com/x),auto}",
    '.x{background:image-set("https://example.com/x" 1x)}',
    ".x{background:u\\72l(https://example.com/x)}",
    ".x{animation:flash 1ms infinite}",
    "@keyframes flash{to{opacity:0}}",
    ".x{width:10000000px}",
    ".x{grid-template-columns:repeat(100000,1fr)}",
    '.x{content:"</style><script>x</script>"}',
  ])("refuses active or unbounded CSS: %s", (css) => {
    expect(() => validateHtmlTemplate(payload("<p>Safe</p>", css))).toThrow(HtmlTemplateError);
  });

  it("namespaces ids, fragments and CSS without treating data keys as application ids", () => {
    const source = payload(
      '<section id="profile" data-key="s0"><a href="#profile">Go</a></section>',
      "#profile{color:red}",
    );
    const template = fromDefinition("test", "Test", { type: "html", version: 1, payload: source });
    expect(renderToStaticMarkup(template.render(FIXTURE_DOCUMENT, {}))).toContain(
      'id="tpl-profile"',
    );
    expect(template.styles({})).toContain("#tpl-profile");
    expect(renderHtmlBody(source, FIXTURE_DOCUMENT, {})).toContain('href="#tpl-profile"');
  });

  it("retains unsupported definitions for portability and refuses rendering without a handler", () => {
    const spec: StoredTemplateSpec = {
      type: "latex",
      version: 1,
      payload: { entry: "main.tex", source: "PRESERVED" },
    };
    code(() => fromDefinition("id", "Unknown", spec), "template-type");
    expect(spec.payload["source"]).toBe("PRESERVED");
  });

  it("accepts a caller-installed type without changing the type vocabulary", () => {
    const spec = { type: "consumer", version: 7, payload: {} };
    const html = HTML_TEMPLATES[0];
    if (html === undefined) throw new Error("Sample exists");
    const custom = [
      { type: "consumer", version: 7, label: "Consumer", validate: () => {}, html: () => html },
    ];
    validateTemplate(spec, custom);
    expect(fromDefinition("id", "Custom", spec, custom)).toBe(html);
  });
});
