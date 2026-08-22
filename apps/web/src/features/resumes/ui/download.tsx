import { fileNameFor, renderHtml } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { Button } from "../../../components/ui/button.js";
import { printFile, saveFile } from "../../../lib/files.js";

const HTML = "text/html;charset=utf-8";

export function DownloadResume({ document }: { document: ResumeDocument }) {
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <h3 className="text-xs font-medium text-slate-600">Take it with you</h3>
      <Button
        tone="primary"
        className="w-full"
        onClick={() => {
          printFile(renderHtml(document));
        }}
      >
        Print or save as PDF
      </Button>
      <Button
        className="w-full"
        onClick={() => {
          saveFile(fileNameFor(document, "html"), HTML, renderHtml(document));
        }}
      >
        Download HTML
      </Button>
      <p className="text-xs leading-relaxed text-slate-500">
        One file, carrying its own styling and fetching nothing. Evidence never travels in it.
      </p>
    </div>
  );
}
