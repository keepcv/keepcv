import type { ExportTarget } from "@keepcv/interop";
import { lossOf, toJsonResume, toLatex, toTypst } from "@keepcv/interop";
import { fileNameFor, renderHtml, renderSite, SITE_FILE_NAME } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { useMemo, useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/ui/field.js";
import { printFile, saveFile } from "../../../lib/files.js";

const HTML = "text/html;charset=utf-8";

interface Target {
  label: string;
  extension: string;
  type: string;
  write: (document: ResumeDocument) => Promise<string | Uint8Array<ArrayBuffer>>;
}

// A Word document is the only one of these that needs a zip writer, so it is
// fetched when it is chosen rather than by everyone who opens this panel.
const TARGETS: Record<ExportTarget, Target> = {
  jsonresume: {
    label: "JSON Resume",
    extension: "json",
    type: "application/json;charset=utf-8",
    write: (document) => Promise.resolve(`${JSON.stringify(toJsonResume(document), null, 2)}\n`),
  },
  docx: {
    label: "Word document",
    extension: "docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    write: async (document) => {
      const { toDocx } = await import("@keepcv/interop/files");
      return toDocx(document);
    },
  },
  latex: {
    label: "LaTeX source",
    extension: "tex",
    type: "application/x-tex;charset=utf-8",
    write: (document) => Promise.resolve(toLatex(document)),
  },
  typst: {
    label: "Typst source",
    extension: "typ",
    type: "text/plain;charset=utf-8",
    write: (document) => Promise.resolve(toTypst(document)),
  },
};

const ORDER: ExportTarget[] = ["jsonresume", "docx", "latex", "typst"];

function Loses({ document, target }: { document: ResumeDocument; target: ExportTarget }) {
  const losses = useMemo(() => lossOf(document, target), [document, target]);
  if (losses.length === 0) {
    return <p className="text-xs text-text-subtle">Everything in this resume fits that format.</p>;
  }

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
export function DownloadResume({
  document,
  onExport,
}: {
  document: ResumeDocument;
  onExport?: (document: ResumeDocument) => Promise<unknown>;
}) {
  const [target, setTarget] = useState<ExportTarget>("jsonresume");
  const [history, setHistory] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<unknown>(null);
  const chosen = TARGETS[target];
  const record = () => {
    if (onExport === undefined) return;
    setHistory("saving");
    void onExport(document).then(
      () => {
        setHistory("saved");
      },
      () => {
        setHistory("failed");
      },
    );
  };

  return (
    <div className="space-y-2">
      <Button
        tone="primary"
        className="w-full"
        onClick={() => {
          printFile(renderHtml(document));
          record();
        }}
      >
        Print or save as PDF
      </Button>
      <Button
        className="w-full"
        onClick={() => {
          saveFile(fileNameFor(document, "html"), HTML, renderHtml(document));
          record();
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
            saveFile(SITE_FILE_NAME, HTML, renderSite(document));
            record();
          }}
        >
          Download personal page
        </Button>
        <p className="text-xs leading-relaxed text-text-subtle">
          The same selection as a page to put online, named {SITE_FILE_NAME} because that is what a
          host looks for. It carries the contact details this resume carries, so the composer is
          where you decide what a stranger sees.
        </p>
      </div>

      <div className="space-y-2 border-t border-line pt-2">
        <SelectField
          label="Somebody else's format"
          value={target}
          onChange={(value) => {
            const found = ORDER.find((one) => one === value);
            if (found !== undefined) setTarget(found);
          }}
          options={ORDER.map((one) => ({ value: one, label: TARGETS[one].label }))}
        />
        <Button
          className="w-full"
          onClick={() => {
            void chosen
              .write(document)
              .then((content) => {
                saveFile(fileNameFor(document, chosen.extension), chosen.type, content);
                record();
              })
              .catch(setError);
          }}
        >
          Download {chosen.label}
        </Button>
        <Loses document={document} target={target} />
      </div>
      {error === null ? null : <Failure error={error} />}
      {history === "idle" ? null : (
        <p role="status" className="text-xs text-text-subtle">
          {history === "saving"
            ? "Recording export history"
            : history === "saved"
              ? "Export recorded in history"
              : "The export is available, but its version could not be saved. Reopen the preview and export again when the store is available."}
        </p>
      )}
    </div>
  );
}
