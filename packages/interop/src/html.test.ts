import { describe, expect, it } from "vitest";
import { readHtml } from "./html.js";

describe("reading the rich text a resume editor writes", () => {
  it("answers nothing for an empty description", () => {
    expect(readHtml("")).toEqual({ summary: null, points: [] });
  });

  it("splits paragraphs from list items, which is the summary and the points", () => {
    const read = readHtml(
      "<p>Ran the platform team.</p><ul><li>Cut deploy time by half.</li></ul>",
    );

    expect(read).toEqual({
      summary: "Ran the platform team.",
      points: ["Cut deploy time by half."],
    });
  });

  it("keeps two paragraphs apart rather than running them into one sentence", () => {
    expect(readHtml("<p>First.</p><p>Second.</p>").summary).toBe("First.\n\nSecond.");
  });

  // The editor wraps every item's text in a paragraph of its own, so a rule
  // that ended a point at the first </p> would drop everything after it.
  it("reads an item whose text is wrapped in a paragraph", () => {
    expect(readHtml("<ul><li><p>Shipped it.</p></li></ul>").points).toEqual(["Shipped it."]);
  });

  it("flattens a list inside a list instead of folding it into its parent", () => {
    const read = readHtml("<ul><li><p>Outer</p><ul><li><p>Inner</p></li></ul></li></ul>");

    expect(read.points).toEqual(["Outer", "Inner"]);
  });

  it("drops emphasis and links but keeps the words", () => {
    const read = readHtml(
      '<p>Built <strong>the</strong> <a href="https://x.example">thing</a>.</p>',
    );

    expect(read.summary).toBe("Built the thing.");
  });

  it("turns a line break into a space rather than gluing two words together", () => {
    expect(readHtml("<p>One<br>Two</p>").summary).toBe("One Two");
  });

  it("decodes the entities an editor writes for characters it cannot store raw", () => {
    expect(readHtml("<p>Tools &amp; process &lt;3 &#39;here&#39;</p>").summary).toBe(
      "Tools & process <3 'here'",
    );
  });

  it("reads text nobody wrapped in anything", () => {
    expect(readHtml("Just a line.").summary).toBe("Just a line.");
  });
});
