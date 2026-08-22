import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT, TEMPLATES } from "@keepcv/templates";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./html.js";

const withMeta = (meta: Partial<ResumeDocument["meta"]>): ResumeDocument => ({
  ...FIXTURE_DOCUMENT,
  meta: { ...FIXTURE_DOCUMENT.meta, ...meta },
});

const matches = (html: string, pattern: RegExp): string[] =>
  [...html.matchAll(pattern)].map((match) => match[1] ?? "");

describe("an exported file", () => {
  // The shared fixture is what every export format renders, so a template added
  // to the registry is exported here without anything being added below.
  describe.each(TEMPLATES.map((template) => [template.id, template] as const))(
    "%s",
    (id, template) => {
      const html = renderHtml(withMeta({ templateId: id }));
      const printed = renderToStaticMarkup(
        template.render(FIXTURE_DOCUMENT, template.defaultConfig),
      );

      it("fetches nothing when it is opened", () => {
        expect(html).not.toMatch(/<link\b/i);
        expect(html).not.toMatch(/<script\b/i);
        expect(html).not.toContain("@import");
        expect(html).not.toMatch(/\bsrc=/i);
        expect(html).not.toMatch(/url\((?!['"]?data:)/);
      });

      // `isATemplate` proves the template links only where the document points.
      // What the file adds on top of that is this package's to answer for.
      it("adds no address the template did not print", () => {
        const found = matches(html, /href="([^"]*)"/g);
        expect(found.length).toBeGreaterThan(0);
        expect(found).toEqual(matches(printed, /href="([^"]*)"/g));
      });

      // Anything the template printed and the file did not is content this
      // product deleted.
      it("carries through every element the template printed", () => {
        const keys = matches(printed, /data-key="([^"]*)"/g);
        expect(keys.length).toBeGreaterThan(0);
        expect(matches(html, /data-key="([^"]*)"/g)).toEqual(keys);
      });
    },
  );

  it("is a document a browser will parse as one", () => {
    const html = renderHtml(FIXTURE_DOCUMENT);
    expect(html.startsWith("<!doctype html>\n<html ")).toBe(true);
    expect(html).toContain('lang="en-GB"');
    expect(html).toMatch(/<meta charset="utf-8"\s*\/?>/i);
  });

  // React serialises a style child as raw text. If that ever stops being true,
  // every child selector stops matching and the file prints unstyled.
  it("keeps the stylesheet as CSS rather than escaping it into text", () => {
    expect(renderHtml(FIXTURE_DOCUMENT)).toContain(".kc-group > .kc-entry");
  });

  it("titles itself with the person and the resume, escaped", () => {
    const html = renderHtml(withMeta({ resumeName: "Staff engineer <script>alert(1)</script>" }));
    expect(html).toContain("<title>Ada Lovelace - Staff engineer &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  // A resume that will not print is the one thing this product may not produce,
  // so an id this build does not hold falls back instead of refusing.
  it("renders a document naming a template this build does not have", () => {
    expect(renderHtml(withMeta({ templateId: "not-installed" }))).toContain("Ada Lovelace");
  });
});
