import { lossOf, toJsonResume } from "@keepcv/interop";
import { fileNameFor, renderHtml } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { useMemo } from "react";
import { Button } from "../../../components/ui/button.js";
import { printFile, saveFile } from "../../../lib/files.js";

const HTML = "text/html;charset=utf-8";
const JSON_TYPE = "application/json;charset=utf-8";

// Named before the download rather than after it: the point of an adapter with a
// declared loss is that the user reads it while the choice is still theirs.
function Loses({ document }: { document: ResumeDocument }) {
  const losses = useMemo(() => lossOf(document), [document]);
  if (losses.length === 0) return null;

  return (
    <details className="text-xs text-slate-500">
      <summary className="cursor-pointer underline-offset-2 hover:text-slate-900 hover:underline">
        {losses.length} {losses.length === 1 ? "thing does" : "things do"} not fit that format
      </summary>
      <ul className="mt-1.5 space-y-1 leading-relaxed">
        {losses.map((loss) => (
          <li key={loss.what}>
            <span className="font-medium text-slate-700">
              {loss.what} ({loss.count})
            </span>{" "}
            {loss.detail}
          </li>
        ))}
      </ul>
    </details>
  );
}

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

      <div className="space-y-2 border-t border-slate-200 pt-2">
        <Button
          className="w-full"
          onClick={() => {
            saveFile(
              fileNameFor(document, "json"),
              JSON_TYPE,
              `${JSON.stringify(toJsonResume(document), null, 2)}\n`,
            );
          }}
        >
          Download JSON Resume
        </Button>
        <Loses document={document} />
      </div>
    </div>
  );
}
