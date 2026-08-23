import { lossOf, toJsonResume } from "@keepcv/interop";
import { fileNameFor, renderHtml } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { useMemo } from "react";
import { Button } from "../../../components/ui/button.js";
import { printFile, saveFile } from "../../../lib/files.js";

const HTML = "text/html;charset=utf-8";
const JSON_TYPE = "application/json;charset=utf-8";

function Loses({ document }: { document: ResumeDocument }) {
  const losses = useMemo(() => lossOf(document), [document]);
  if (losses.length === 0) return null;

  return (
    <details className="text-xs text-text-subtle">
      <summary className="cursor-pointer underline-offset-2 hover:text-text hover:underline">
        {losses.length} {losses.length === 1 ? "thing does" : "things do"} not fit that format
      </summary>
      <ul className="mt-1.5 space-y-1 leading-relaxed">
        {losses.map((loss) => (
          <li key={loss.what}>
            <span className="font-medium text-text-muted">
              {loss.what} ({loss.count})
            </span>{" "}
            {loss.detail}
          </li>
        ))}
      </ul>
    </details>
  );
}

// The heading and the box come from the group this sits in.
export function DownloadResume({ document }: { document: ResumeDocument }) {
  return (
    <div className="space-y-2">
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
      <p className="text-xs leading-relaxed text-text-subtle">
        One file, carrying its own styling and fetching nothing. Evidence never travels in it.
      </p>

      <div className="space-y-2 border-t border-line pt-2">
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
