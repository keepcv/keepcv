import type { Element, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { resolveAsset } from "./assets.js";
import { checkedCss } from "./css.js";
import { HtmlTemplateError } from "./error.js";

const TAGS = new Set([
  "a",
  "abbr",
  "article",
  "aside",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "main",
  "mark",
  "nav",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
  "wbr",
]);
const ATTRIBUTES = new Set([
  "id",
  "className",
  "title",
  "lang",
  "dir",
  "role",
  "ariaLabel",
  "ariaLabelledBy",
  "ariaDescribedBy",
  "ariaHidden",
  "dataKey",
  "dataField",
  "style",
  "href",
  "src",
  "alt",
  "width",
  "height",
  "colSpan",
  "rowSpan",
  "scope",
  "dateTime",
  "start",
  "value",
  "reversed",
  "open",
]);

function hyperlink(value: unknown, file: string): string {
  const address = String(value);
  if (
    [...address].some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new HtmlTemplateError(
      "unsafe-url",
      "Links cannot contain whitespace or control characters.",
      file,
    );
  if (/^#[a-zA-Z0-9_.:-]+$/.test(address)) return `#tpl-${address.slice(1)}`;
  if (!/^(?:https?:\/\/|mailto:|tel:)/i.test(address))
    throw new HtmlTemplateError(
      "unsafe-url",
      "Links use http, https, mailto, tel or a document fragment.",
      file,
    );
  return address;
}

function elementPolicy(
  node: Element,
  assets: ReadonlyMap<string, string>,
  file: string,
  sourceOnly: boolean,
): void {
  if (!TAGS.has(node.tagName))
    throw new HtmlTemplateError(
      "unsafe-markup",
      `Unsupported HTML element: ${node.tagName}.`,
      file,
      node.position?.start.line,
    );
  for (const [name, value] of Object.entries(node.properties)) {
    if (!ATTRIBUTES.has(name))
      throw new HtmlTemplateError(
        "unsafe-markup",
        `Unsupported HTML attribute: ${name}.`,
        file,
        node.position?.start.line,
      );
    if (
      sourceOnly &&
      typeof value === "string" &&
      value.includes("{{") &&
      ["href", "src", "id", "width", "height", "colSpan", "rowSpan", "start"].includes(name)
    ) {
      if (name === "href" && !/^(?:\{\{|#|https?:\/\/|mailto:|tel:)/i.test(value))
        throw new HtmlTemplateError("unsafe-url", "Unsupported hyperlink scheme.", file);
      continue;
    }
    if (name === "href") {
      if (node.tagName !== "a")
        throw new HtmlTemplateError("unsafe-markup", "Only hyperlinks may carry href.", file);
      node.properties[name] = hyperlink(value, file);
    }
    if (name === "src") {
      if (node.tagName !== "img")
        throw new HtmlTemplateError("unsafe-markup", "Only images may carry src.", file);
      const asset = resolveAsset(String(value), assets, file);
      if (!asset.startsWith("data:image/"))
        throw new HtmlTemplateError(
          "unsafe-resource",
          "An image source must name an image asset.",
          file,
        );
      node.properties[name] = asset;
    }
    if (name === "id") {
      if (!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(String(value)))
        throw new HtmlTemplateError("unsafe-markup", "Use a simple document id.", file);
      node.properties[name] = `tpl-${String(value)}`;
    }
    if (name === "ariaLabelledBy" || name === "ariaDescribedBy")
      node.properties[name] = (Array.isArray(value) ? value : String(value).split(/\s+/)).map(
        (id) => `tpl-${String(id)}`,
      );
    if (name === "style") node.properties[name] = checkedCss(String(value), file, assets, true);
    if (
      ["width", "height", "colSpan", "rowSpan", "start"].includes(name) &&
      (!/^\d{1,4}$/.test(String(value)) || Number(value) > 4096)
    )
      throw new HtmlTemplateError(
        "markup-budget",
        "HTML dimensions or spans exceed their budget.",
        file,
      );
  }
  if (
    node.tagName === "img" &&
    (!Object.hasOwn(node.properties, "alt") || !Object.hasOwn(node.properties, "src"))
  )
    throw new HtmlTemplateError(
      "unsafe-markup",
      "Images need a bundled source and an alt attribute.",
      file,
    );
}

export function checkedMarkup(
  source: string,
  file: string,
  assets: ReadonlyMap<string, string>,
  sourceOnly = false,
): string {
  if (/<\/?(?:html|head|body)\b/i.test(source))
    throw new HtmlTemplateError(
      "unsafe-markup",
      "Write the body content; KeepCV supplies the document shell.",
      file,
    );
  let parsed: Root;
  try {
    parsed = fromHtml(source, { fragment: true });
  } catch {
    throw new HtmlTemplateError("html-syntax", "HTML could not be parsed.", file);
  }
  const pending: { node: RootContent; depth: number }[] = parsed.children.map((node) => ({
    node,
    depth: 0,
  }));
  let nodes = 0;
  while (pending.length > 0) {
    const item = pending.pop();
    if (item === undefined) break;
    nodes += 1;
    if (nodes > 20_000 || item.depth > 64)
      throw new HtmlTemplateError(
        "markup-budget",
        "HTML exceeds its node or nesting budget.",
        file,
      );
    if (item.node.type === "element") {
      elementPolicy(item.node, assets, file, sourceOnly);
      for (const child of item.node.children) pending.push({ node: child, depth: item.depth + 1 });
    } else if (!["text", "comment"].includes(item.node.type))
      throw new HtmlTemplateError("unsafe-markup", "Unsupported HTML node.", file);
  }
  return toHtml(parsed, { allowDangerousHtml: false });
}
