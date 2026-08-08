import { describe, expect, it } from "vitest";
import { type Inline, richTextSchema } from "./rich-text.js";

const text = (v: string): Inline => ({ t: "text", v });
const bold = (...c: Inline[]): Inline => ({ t: "b", c });
const link = (href: string, ...c: Inline[]): Inline => ({ t: "a", href, c });

describe("richTextSchema", () => {
  it("accepts plain text", () => {
    expect(richTextSchema.parse([text("Cut p95 latency")])).toEqual([text("Cut p95 latency")]);
  });

  it("accepts marks nested three deep", () => {
    const value = [bold({ t: "i", c: [link("https://example.com", text("here"))] })];
    expect(richTextSchema.safeParse(value).success).toBe(true);
  });

  it("rejects marks nested four deep", () => {
    const value = [bold(bold(bold(bold(text("too far")))))];
    expect(richTextSchema.safeParse(value).success).toBe(false);
  });

  it("rejects a link inside a link", () => {
    const value = [link("https://example.com", link("https://example.org", text("nested")))];
    expect(richTextSchema.safeParse(value).success).toBe(false);
  });

  it.each(["https://example.com", "http://example.com", "mailto:someone@example.com"])(
    "accepts an %s link",
    (href) => {
      expect(richTextSchema.safeParse([link(href, text("go"))]).success).toBe(true);
    },
  );

  it.each(["javascript:alert(1)", "data:text/html,<script>", "/relative", ""])(
    "rejects an %s link",
    (href) => {
      expect(richTextSchema.safeParse([link(href, text("go"))]).success).toBe(false);
    },
  );

  it("rejects block constructs", () => {
    expect(richTextSchema.safeParse([{ t: "p", c: [text("nope")] }]).success).toBe(false);
  });
});
