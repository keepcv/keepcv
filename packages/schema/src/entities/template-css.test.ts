import { describe, expect, it } from "vitest";
import { extraCssSchema } from "./template.js";

describe("local template CSS", () => {
  it.each([
    '.kc-doc { background: u\\72 l("https://example.test/a"); }',
    ".kc-doc { background: \\75\\72\\6c(https://example.test/a); }",
    '@im\\70 ort "https://example.test/a";',
    '@IMPORT "https://example.test/a";',
    '.kc-doc { background: image-set("https://example.test/a" 1x); }',
    '.kc-doc { background: -webkit-image-set("https://example.test/a" 1x); }',
    '.kc-doc { background: image("https://example.test/a"); }',
    '.kc-doc { background: src("https://example.test/a"); }',
    '.kc-doc { --image: url("https://example.test/a"); background: var(--image); }',
    '.kc-doc { background: url("\\68 ttps://example.test/a"); }',
    '@future-resource "https://example.test/a";',
    '.kc-doc { background: future-resource("https://example.test/a"); }',
    "</STYLE><script>alert(1)</script>",
  ])("refuses resource-bearing or unknown CSS: %s", (css) => {
    expect(extraCssSchema.safeParse(css).success).toBe(false);
  });

  it.each([
    ".kc-doc { color: #123; margin: calc(1em + 2px); }",
    '.kc-doc { background: url("data:image/gif;base64,R0lGOD"); }',
    ".kc-doc { background: u\\72 l(data:image/gif;base64,R0lGOD); }",
    "@media print { .kc-doc { color: rgb(1, 2, 3); } }",
    "@supports (display: grid) { .kc-doc { grid-template-columns: repeat(2, minmax(0, 1fr)); } }",
    '.kc-doc::after { content: "@import url(https://example.test/a)"; }',
    "/* @import url(https://example.test/a) */ .kc-doc { color: red; }",
    ".kc-doc { background: linear-gradient(red, blue); }",
    '.kc-doc:has(a[href^="mailto:"]) { color: red; }',
  ])("accepts local CSS: %s", (css) => {
    expect(extraCssSchema.safeParse(css).success).toBe(true);
  });
});
