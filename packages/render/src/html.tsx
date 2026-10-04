import type { ResumeDocument } from "@keepcv/schema";
import { resolveTemplate } from "@keepcv/templates";
import { renderToStaticMarkup } from "react-dom/server";
import { DOCUMENT_CONTENT_POLICY } from "./content-policy.js";
import { documentTitle } from "./title.js";

export function renderHtml(document: ResumeDocument): string {
  const { template, config } = resolveTemplate(document);

  const markup = renderToStaticMarkup(
    <html lang={document.meta.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Security-Policy" content={DOCUMENT_CONTENT_POLICY} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{documentTitle(document)}</title>
        <style>{template.styles(config)}</style>
      </head>
      <body>{template.render(document, config)}</body>
    </html>,
  );

  return `<!doctype html>\n${markup}\n`;
}
