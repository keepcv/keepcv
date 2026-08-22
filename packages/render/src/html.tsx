import type { ResumeDocument } from "@keepcv/schema";
import { resolveTemplate } from "@keepcv/templates";
import { renderToStaticMarkup } from "react-dom/server";
import { documentTitle } from "./title.js";

// One file with nothing to fetch. The stylesheet goes inline and `isATemplate`
// is what keeps it from naming an address (template-model.md #5), so the same
// bytes print the same way on a machine that has never seen this store.
export function renderHtml(document: ResumeDocument): string {
  const { template, config } = resolveTemplate(document);

  const markup = renderToStaticMarkup(
    <html lang={document.meta.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{documentTitle(document)}</title>
        <style>{template.styles(config)}</style>
      </head>
      <body>{template.render(document, config)}</body>
    </html>,
  );

  return `<!doctype html>\n${markup}\n`;
}
