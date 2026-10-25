import type { HtmlTemplatePayload, ResumeDocument, TemplateDefinition } from "@keepcv/schema";
import { htmlTemplatePayloadSchema, templateDataSchema, templateTextBytes } from "@keepcv/schema";
import { createElement } from "react";
import type { Template, TemplateConfig } from "../contract.js";
import { PAGE_SIZE_FIELD } from "../paper.js";
import { assetUrls } from "./assets.js";
import { compileBindings } from "./bindings.js";
import { checkedCss } from "./css.js";
import { HtmlTemplateError } from "./error.js";
import { checkedMarkup } from "./markup.js";

export function htmlScope(
  document: ResumeDocument,
  page: HtmlTemplatePayload["page"],
): Record<string, unknown> {
  const scope = templateDataSchema.parse({ resume: document, page });
  const json = JSON.stringify(scope);
  if (templateTextBytes(json) > 2 * 1024 * 1024)
    throw new HtmlTemplateError("document-budget", "Selected template data exceeds 2 MiB.");
  return JSON.parse(json) as Record<string, unknown>;
}

export function htmlPage(
  payload: HtmlTemplatePayload,
  config: TemplateConfig,
): HtmlTemplatePayload["page"] {
  return {
    size:
      config["pageSize"] === "letter"
        ? "letter"
        : config["pageSize"] === "a4"
          ? "a4"
          : payload.page.size,
    marginMm:
      typeof config["margin"] === "number"
        ? Math.max(0, Math.min(35, config["margin"]))
        : payload.page.marginMm,
  };
}

export function htmlStyles(payload: HtmlTemplatePayload, config: TemplateConfig): string {
  const assets = assetUrls(payload);
  const page = htmlPage(payload, config);
  const [width, height] = page.size === "letter" ? [215.9, 279.4] : [210, 297];
  const styles = payload.styles.map((path) =>
    checkedCss(payload.files[path]?.content ?? "", path, assets),
  );
  return `:root{--page-width:${String(width)}mm;--page-height:${String(height)}mm;--page-margin:${String(page.marginMm)}mm;--kc-page-content-height:${String(height - page.marginMm * 2)}mm}
.kc-html .kc-page{width:var(--page-width);min-height:var(--page-height);background:white}
${styles.join("\n")}
html,body{margin:0}.kc-html>.kc-page>.paper{margin:0}
@page{size:${page.size};margin:${String(page.marginMm)}mm}
@media print{.kc-html .kc-page{width:auto;min-height:0}.kc-html>.kc-page>.paper{margin:0}}
`;
}

export function renderHtmlBody(
  payload: HtmlTemplatePayload,
  document: ResumeDocument,
  config: TemplateConfig,
): string {
  const render = compileBindings(payload);
  const source = render(htmlScope(document, htmlPage(payload, config)));
  return checkedMarkup(source, payload.entry, assetUrls(payload));
}

export function validateHtmlTemplate(payload: HtmlTemplatePayload): void {
  compileBindings(payload);
  const assets = assetUrls(payload);
  for (const [path, file] of Object.entries(payload.files)) {
    if (file.mediaType === "text/html") checkedMarkup(file.content, path, assets, true);
    if (file.mediaType === "text/css") checkedCss(file.content, path, assets);
  }
}

export function fromHtmlDefinition(
  id: string,
  name: string,
  definition: TemplateDefinition,
): Template {
  const parsed = htmlTemplatePayloadSchema.safeParse(definition.payload);
  if (!parsed.success)
    throw new HtmlTemplateError(
      "invalid-bundle",
      parsed.error.issues[0]?.message ?? "Invalid HTML bundle.",
    );
  const payload = parsed.data;
  return {
    id,
    name,
    type: "html",
    definition,
    version: "1",
    documentVersions: payload.documentVersions,
    fields: [
      { ...PAGE_SIZE_FIELD, default: payload.page.size },
      {
        key: "margin",
        label: "Page margin",
        kind: "number",
        default: payload.page.marginMm,
        min: 0,
        max: 35,
        step: 1,
        unit: "mm",
      },
    ],
    defaultConfig: { pageSize: payload.page.size, margin: payload.page.marginMm },
    complianceNotes: [
      "Authored HTML controls this layout. Creative layout may change reading order; checks are advisory.",
      "Page estimates are unavailable for arbitrary HTML layouts. Check browser print preview.",
    ],
    styles: (config) => htmlStyles(payload, config),
    render: (document, config) => {
      if (!payload.documentVersions.includes(document.schemaVersion))
        throw new HtmlTemplateError(
          "document-version",
          "This template does not support this document version.",
        );
      return createElement(
        "div",
        { className: "kc-doc kc-html" },
        createElement("div", {
          className: "kc-page",
          dangerouslySetInnerHTML: { __html: renderHtmlBody(payload, document, config) },
        }),
      );
    },
  };
}
