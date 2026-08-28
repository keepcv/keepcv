import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./html.js";
import { renderSite } from "./site.js";

const matches = (html: string, pattern: RegExp): string[] =>
  [...html.matchAll(pattern)].map((match) => match[1] ?? "");

const variant = (parts: Partial<ResumeDocument>): ResumeDocument => ({
  ...FIXTURE_DOCUMENT,
  ...parts,
});

describe("a personal page", () => {
  const html = renderSite(FIXTURE_DOCUMENT);

  it("is a document a browser will parse as one", () => {
    expect(html.startsWith("<!doctype html>\n<html ")).toBe(true);
    expect(html).toContain('lang="en-GB"');
    expect(html).toMatch(/<meta charset="utf-8"\s*\/?>/i);
    expect(html).toContain('name="viewport"');
  });

  it("fetches nothing when it is opened", () => {
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toContain("@import");
    expect(html).not.toMatch(/\bsrc=/i);
    expect(html).not.toMatch(/url\((?!['"]?data:)/);
  });

  // A page is uploaded somewhere; a resume is sent to one person. The only
  // addresses on it are the ones the document already named.
  it("adds no address the document did not carry", () => {
    const found = new Set(matches(html, /href="([^"]*)"/g));
    const carried = new Set(matches(renderHtml(FIXTURE_DOCUMENT), /href="([^"]*)"/g));
    for (const address of found) {
      if (address.startsWith("#")) continue;
      expect(carried.has(address), address).toBe(true);
    }
  });

  it("prints every entry and every point the document holds", () => {
    const entries = FIXTURE_DOCUMENT.sections.flatMap((section) => section.entries);
    for (const entry of entries) {
      expect(html).toContain(`data-key="${entry.key}"`);
      for (const point of entry.points) expect(html).toContain(`data-key="${point.key}"`);
    }
  });

  it("escapes what the user wrote rather than printing it as markup", () => {
    const page = renderSite({
      ...FIXTURE_DOCUMENT,
      header: { ...FIXTURE_DOCUMENT.header, fullName: "Ada <script>alert(1)</script>" },
    });
    expect(page).toContain("Ada &lt;script&gt;");
    expect(page).not.toContain("<script>");
  });

  it("carries the headline as the description a link preview would read", () => {
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(renderSite(variant({ header: { contacts: [] } }))).not.toContain('name="description"');
  });

  // Scrolling is how a page is read, so it gets the jump list a sheet has no
  // use for - and one section is not a list.
  it("offers a jump to each section, and none when there is one", () => {
    const anchors = matches(html, /<a href="#(s-[^"]*)"/g);
    expect(anchors.length).toBeGreaterThan(1);
    for (const target of anchors) expect(html).toContain(`id="${target}"`);
    // Derived from the key, so renaming a heading leaves existing links alone.
    for (const section of FIXTURE_DOCUMENT.sections) {
      if (section.entries.length > 0) expect(anchors).toContain(`s-${section.key}`);
    }

    const single = renderSite(variant({ sections: FIXTURE_DOCUMENT.sections.slice(0, 1) }));
    expect(single).not.toContain('class="kc-jump"');
  });

  it("leaves out a section the resume placed nothing in", () => {
    const held = FIXTURE_DOCUMENT.sections[0];
    if (held === undefined) throw new Error("the fixture holds a section");
    const empty = { ...held, key: "empty", heading: "Nothing here", entries: [] };
    const page = renderSite(variant({ sections: [...FIXTURE_DOCUMENT.sections, empty] }));
    expect(page).not.toContain("Nothing here");
  });

  it("names the person when a header carries nothing but the resume does", () => {
    expect(renderSite(variant({ header: { contacts: [] } }))).toContain(
      FIXTURE_DOCUMENT.meta.resumeName,
    );
  });

  // A stylesheet React escaped into text prints an unstyled page.
  it("keeps the stylesheet as CSS rather than escaping it into text", () => {
    expect(html).toContain(".kc-entry-head");
    expect(html).toContain("prefers-color-scheme");
  });

  // Internal filing vocabulary, not words anybody chose to publish: a record
  // tagged "boring but paid well" is a record whose tag must not leave.
  it("prints none of the words the store files work under", () => {
    const [first, ...rest] = FIXTURE_DOCUMENT.sections;
    if (first?.entries[0] === undefined) throw new Error("the fixture holds an entry");
    const entry = { ...first.entries[0], tags: ["boring but paid well"] };

    const page = renderSite(
      variant({ sections: [{ ...first, entries: [entry, ...first.entries.slice(1)] }, ...rest] }),
    );
    expect(page).not.toContain("boring but paid well");
  });

  // The page is the one output that goes somewhere public, so it may print less
  // than the resume and must never print more.
  it("prints no element the resume would not have printed", () => {
    const carried = new Set(matches(renderHtml(FIXTURE_DOCUMENT), /data-key="([^"]*)"/g));
    const found = matches(html, /data-key="([^"]*)"/g);
    expect(found.length).toBeGreaterThan(0);
    for (const key of found) expect(carried.has(key), key).toBe(true);
  });
});
