import { cssIsLocal } from "@keepcv/schema";
import { generate, ident, parse, walk } from "css-tree";
import { resolveAsset } from "./assets.js";
import { HtmlTemplateError } from "./error.js";

const AT_RULES = new Set(["media", "supports", "container", "layer", "font-face", "property"]);

export function checkedCss(
  source: string,
  file: string,
  assets: ReadonlyMap<string, string>,
  inline = false,
): string {
  if (/<\/style/i.test(source))
    throw new HtmlTemplateError("unsafe-css", "CSS cannot close its style element.", file);
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(source, {
      positions: true,
      parseCustomProperty: true,
      context: inline ? "declarationList" : "stylesheet",
    });
  } catch {
    throw new HtmlTemplateError("css-syntax", "CSS could not be parsed.", file);
  }
  let nodes = 0;
  walk(parsed, (node) => {
    nodes += 1;
    if (nodes > 20_000)
      throw new HtmlTemplateError("css-budget", "CSS exceeds its node budget.", file);
    if (node.type === "Atrule" && !AT_RULES.has(ident.decode(node.name).toLowerCase()))
      throw new HtmlTemplateError(
        "unsafe-css",
        "This CSS at-rule is unavailable; page size is set by the page controls.",
        file,
        node.loc?.start.line,
      );
    if (node.type === "Declaration") {
      const property = ident.decode(node.property).toLowerCase();
      if (
        /^(?:-\w+-)?(?:animation|transition)(?:-|$)/.test(property) ||
        ["behavior", "-moz-binding"].includes(property)
      )
        throw new HtmlTemplateError(
          "unsafe-css",
          "Templates are static documents; active CSS is unavailable.",
          file,
          node.loc?.start.line,
        );
    }
    if (node.type === "Url") node.value = resolveAsset(node.value, assets, file);
    if (node.type === "IdSelector") node.name = `tpl-${node.name}`;
    if (
      (node.type === "Number" || node.type === "Dimension" || node.type === "Percentage") &&
      Math.abs(Number(node.value)) > 10_000
    )
      throw new HtmlTemplateError(
        "css-budget",
        "CSS numeric values exceed the layout budget.",
        file,
        node.loc?.start.line,
      );
    if (node.type === "Function" && ident.decode(node.name).toLowerCase() === "repeat") {
      const first = node.children.first;
      if (first?.type === "Number" && Number(first.value) > 64)
        throw new HtmlTemplateError(
          "css-budget",
          "A grid repeat is limited to 64 tracks.",
          file,
          node.loc?.start.line,
        );
    }
  });
  const css = generate(parsed);
  if (!cssIsLocal(css) || /<\/style/i.test(css))
    throw new HtmlTemplateError(
      "unsafe-css",
      "CSS contains unsupported functions or resource syntax.",
      file,
    );
  return css;
}
