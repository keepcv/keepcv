import type { ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { type BlockRole, toBlocks } from "./blocks.js";

const BLOCKS = toBlocks(FIXTURE_DOCUMENT);

const roles = (): BlockRole[] => BLOCKS.map((one) => one.role);

const said = (role: BlockRole): string[] =>
  BLOCKS.filter((one) => one.role === role).map((one) =>
    one.text.map((node) => (node.t === "text" ? node.v : "")).join(""),
  );

describe("laying a document out as blocks", () => {
  it("opens with the person, once, in the order a reader meets them", () => {
    const opening = roles().slice(0, 5);
    expect(opening).toEqual(["name", "headline", "headline", "contacts", "note"]);
    expect(said("name")).toEqual(["Ada Lovelace"]);
  });

  it("carries every heading and every point the document holds", () => {
    const printed = FIXTURE_DOCUMENT.sections.filter((section) => section.entries.length > 0);
    const points = printed.reduce(
      (total, section) => total + section.entries.reduce((n, entry) => n + entry.points.length, 0),
      0,
    );

    expect(said("heading")).toEqual(printed.map((section) => section.heading));
    expect(roles().filter((role) => role === "point")).toHaveLength(points);
  });

  // A section with nothing under it is a heading with nothing after it, which
  // is a heading a reader has to work out the meaning of.
  it("leaves out a section that has no entries", () => {
    const empty = FIXTURE_DOCUMENT.sections.find((section) => section.entries.length === 0);
    expect(empty).toBeDefined();
    expect(said("heading")).not.toContain(empty?.heading);
  });

  it("sets the period aside from the title rather than after it", () => {
    const heads = BLOCKS.filter((one) => one.role === "entry");
    expect(heads.some((one) => one.aside === "Apr 2023 - Present")).toBe(true);
    expect(said("entry")).not.toContain("Staff engineer - Ingest platform Apr 2023 - Present");
  });

  it("keeps a point's metrics on the point", () => {
    const metric = FIXTURE_DOCUMENT.sections
      .flatMap((section) => section.entries)
      .flatMap((entry) => entry.points)
      .flatMap((point) => point.metrics)[0];
    expect(metric).toBeDefined();

    const carrying = said("point").filter((text) =>
      text.includes(`(${metric?.label ?? ""}: ${metric?.display ?? ""})`),
    );
    expect(carrying).toHaveLength(1);
  });

  it("makes a contact and a url field reachable as links", () => {
    const targets = BLOCKS.flatMap((one) => one.text)
      .filter((node) => node.t === "a")
      .map((node) => node.href);

    expect(targets).toContain("mailto:ada@example.org");
    expect(targets).toContain("https://github.com/ada");
  });

  // Compared against a document with the tags taken off rather than searched by
  // word: one fixture tag is also a word in a heading, so a search finds that.
  it("writes no tag", () => {
    const tags = FIXTURE_DOCUMENT.sections
      .flatMap((section) => section.entries)
      .flatMap((entry) => entry.tags);
    expect(tags.length).toBeGreaterThan(0);

    const untagged: ResumeDocument = {
      ...FIXTURE_DOCUMENT,
      sections: FIXTURE_DOCUMENT.sections.map((section) => ({
        ...section,
        entries: section.entries.map((entry) => ({
          ...entry,
          tags: [],
          points: entry.points.map((point) => ({ ...point, tags: [] })),
        })),
      })),
    };

    expect(toBlocks(untagged)).toEqual(BLOCKS);
  });

  it("falls back on the resume's name when the profile has none", () => {
    const nameless: ResumeDocument = {
      ...FIXTURE_DOCUMENT,
      header: { ...FIXTURE_DOCUMENT.header, fullName: undefined },
    };
    const [first] = toBlocks(nameless);
    expect(first).toMatchObject({ role: "name" });
    expect(first?.text).toEqual([{ t: "text", v: FIXTURE_DOCUMENT.meta.resumeName }]);
  });
});
