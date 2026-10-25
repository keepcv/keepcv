import type { ExportTarget } from "@keepcv/interop";
import { lossOf, toJsonResume, toLatex, toTypst } from "@keepcv/interop";
import { fileNameFor, renderSite, SITE_FILE_NAME } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { useMemo, useRef, useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { SelectField } from "../../../components/ui/field.js";
import { printFile, saveFile } from "../../../lib/files.js";

import { isHtmlTemplate, renderTemplate } from "../../templates/model/render-template.js";

const HTML = "text/html;charset=utf-8";
interface Target {
  label: string;
  extension: string;
  type: string;
  write: (document: ResumeDocument) => Promise<string | Uint8Array<ArrayBuffer>>;
}
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
const ORDER: ExportTarget[] = ["docx", "jsonresume", "latex", "typst"];
type Format = "pdf" | "html" | "site" | ExportTarget;
const OPTIONS: { value: Format; label: string }[] = [
  { value: "html", label: "HTML document" },
  { value: "site", label: "Personal web page" },
  ...ORDER.map((one) => ({ value: one, label: TARGETS[one].label })),
];

async function writeFile(document: ResumeDocument, format: Format) {
  if (format === "pdf") {
    printFile(await renderTemplate(document));
    return;
  }
  if (format === "html") {
    saveFile(fileNameFor(document, "html"), HTML, await renderTemplate(document));
    return;
  }
  if (format === "site") {
    saveFile(SITE_FILE_NAME, HTML, renderSite(document));
    return;
  }
  const chosen = TARGETS[format];
  saveFile(fileNameFor(document, chosen.extension), chosen.type, await chosen.write(document));
}

function Loses({ document, target }: { document: ResumeDocument; target: ExportTarget }) {
  const losses = useMemo(() => lossOf(document, target), [document, target]);
  if (losses.length === 0) return null;
  return (
    <div className="space-y-2 text-xs text-text-muted">
      <p className="font-medium">This format changes or omits:</p>
      <ul className="space-y-1.5">
        {losses.map((loss) => (
          <li key={loss.what}>
            <span className="font-medium">
              {loss.what} ({loss.count})
            </span>{" "}
            {loss.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DownloadResume({
  document,
  beforeExport,
  onExport,
}: {
  document: ResumeDocument;
  beforeExport?: () => Promise<boolean>;
  onExport?: (document: ResumeDocument) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("html");
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [history, setHistory] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<unknown>(null);
  const target = ORDER.find((one) => one === format);
  const label =
    target === undefined ? (format === "site" ? "personal page" : "HTML") : TARGETS[target].label;
  const deliver = async (pdf: boolean) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (beforeExport !== undefined && !(await beforeExport()))
        throw new Error(
          "Fit settings could not be saved. Retry saving before exporting this preview.",
        );
      await writeFile(document, pdf ? "pdf" : format);
      if (onExport !== undefined) {
        setHistory("saving");
        try {
          await onExport(document);
          setHistory("saved");
        } catch {
          setHistory("failed");
        }
      }
    } catch (reason) {
      setError(reason);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="max-w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon="download"
          pending={busy}
          onClick={() => {
            void deliver(true);
          }}
        >
          Export PDF
        </Button>
        <Button expanded={open} disabled={busy} onClick={() => setOpen(true)}>
          Other formats
        </Button>
      </div>
      {error === null ? null : <Failure error={error} />}
      {history === "idle" ? null : (
        <p role="status" className="max-w-sm text-xs text-text-subtle">
          {history === "saving"
            ? "Recording export history"
            : history === "saved"
              ? "Export recorded in history"
              : "The export is available, but its version could not be saved. Export again when the store is available."}
        </p>
      )}
      {open ? (
        <Dialog title="Other formats" onClose={() => setOpen(false)}>
          <div className="space-y-4 p-4">
            <SelectField
              label="File format"
              value={format}
              onChange={(value) => {
                const found = OPTIONS.find((option) => option.value === value);
                if (found !== undefined) setFormat(found.value);
              }}
              options={OPTIONS}
            />
            {isHtmlTemplate(document) && format !== "html" ? (
              <p className="text-xs text-text-muted">
                This format uses its own layout. Authored HTML styling is preserved in HTML and PDF
                exports.
              </p>
            ) : null}
            {target === undefined ? null : <Loses document={document} target={target} />}
            <Button
              tone="primary"
              pending={busy}
              onClick={() => {
                void deliver(false);
              }}
            >
              Download {label}
            </Button>
            {error === null ? null : <Failure error={error} />}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
