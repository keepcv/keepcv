import type { Pagination } from "@keepcv/core";
import type { ResumeDocument } from "@keepcv/schema";
import { resolveTemplate } from "@keepcv/templates";
import { useCallback, useState } from "react";
import { SelectField } from "../../../components/ui/field.js";
import { isHtmlTemplate } from "../../templates/model/render-template.js";
import { HtmlPreview } from "./html-preview.js";
import { TemplateFrame } from "./template-frame.js";

function DefaultPreview({
  document,
  pageLimit,
  onPaginate,
}: {
  document: ResumeDocument;
  pageLimit?: number | null;
  onPaginate?: (pagination: Pagination) => void;
}) {
  const { template, config } = resolveTemplate(document);
  const [zoom, setZoom] = useState("fit");
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const report = useCallback(
    (pagination: Pagination) => {
      setPages(pagination.pages);
      onPaginate?.(pagination);
    },
    [onPaginate],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-end gap-3">
        <div className="w-32">
          <SelectField
            label="Zoom"
            value={zoom}
            onChange={setZoom}
            options={[
              { value: "fit", label: "Fit to width" },
              { value: "0.75", label: "75%" },
              { value: "1", label: "100%" },
              { value: "1.25", label: "125%" },
            ]}
          />
        </div>
        {pages > 1 ? (
          <div className="w-32">
            <SelectField
              label="Go to page"
              value={String(Math.min(page, pages))}
              onChange={(value) => setPage(Number(value))}
              options={Array.from({ length: pages }, (_, index) => ({
                value: String(index + 1),
                label: `Page ${String(index + 1)}`,
              }))}
            />
          </div>
        ) : null}
        <p className="mb-2 ml-auto text-xs tabular-nums text-text-subtle">
          {String(pages)} {pages === 1 ? "page" : "pages"}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface-sunken p-3 sm:p-5">
        <TemplateFrame
          title={`${document.meta.resumeName}, as it prints`}
          styles={template.styles(config)}
          zoom={zoom === "fit" ? undefined : Number(zoom)}
          page={Math.min(page, pages)}
          overflowsFrom={pageLimit ?? undefined}
          onPaginate={report}
        >
          {template.render(document, config)}
        </TemplateFrame>
      </div>
    </div>
  );
}

export function PaperPreview(props: Parameters<typeof DefaultPreview>[0]) {
  if (isHtmlTemplate(props.document)) return <HtmlPreview document={props.document} />;
  try {
    resolveTemplate(props.document);
  } catch (error) {
    return (
      <p role="alert" className="text-xs text-critical-text">
        {error instanceof Error ? error.message : "Template unavailable."}
      </p>
    );
  }
  return <DefaultPreview {...props} />;
}
