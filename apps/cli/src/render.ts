import { writeFile } from "node:fs/promises";
import type { LintReport } from "@keepcv/ats-lint";
import { lint } from "@keepcv/ats-lint";
import { compile } from "@keepcv/core";
import type { ExportTarget, Loss } from "@keepcv/interop";
import { lossOf, toJsonResume, toLatex, toTypst } from "@keepcv/interop";
import { toDocx } from "@keepcv/interop/files";
import { fileNameFor, renderHtml, renderSite, SITE_FILE_NAME } from "@keepcv/render";
import type { Resume, ResumeDocument, Store } from "@keepcv/schema";
import { withStore } from "./store.js";

export const FORMATS = ["html", "site", "jsonresume", "docx", "latex", "typst"] as const;
export type Format = (typeof FORMATS)[number];

// What each one is called on disk and how it is written. A Word document is
// bytes and the other three are text, which is the only difference here.
const WRITERS: Record<
  ExportTarget,
  { extension: string; write: (document: ResumeDocument) => string | Uint8Array }
> = {
  jsonresume: {
    extension: "json",
    write: (document) => `${JSON.stringify(toJsonResume(document), null, 2)}\n`,
  },
  docx: { extension: "docx", write: toDocx },
  latex: { extension: "tex", write: toLatex },
  typst: { extension: "typ", write: toTypst },
};

export interface RenderRequest {
  dataDir: string;
  resume: string | undefined;
  out: string | undefined;
  format?: Format;
}

export interface Chooser {
  choose: readonly Resume[];
  because: "none named" | "no match" | "ambiguous";
}

export type RenderResult =
  | { wrote: string; report: LintReport }
  | { wrote: string; loss: Loss[] }
  | { wrote: string; page: true }
  | Chooser;

const live = (resumes: readonly Resume[]): Resume[] =>
  resumes.filter((resume) => resume.archivedAt === null);

// Id, then the whole name, then whatever part of a name someone would actually
// type. An archived resume still renders when it is named exactly, because the
// reason to reach for one is usually to see what was sent.
function matching(store: Store, asked: string): Resume[] {
  const exact = store.resumes.filter(
    (resume) => resume.id === asked || resume.name.toLowerCase() === asked.toLowerCase(),
  );
  if (exact.length > 0) return exact;

  const needle = asked.toLowerCase();
  return live(store.resumes).filter((resume) => resume.name.toLowerCase().includes(needle));
}

const targetOf = (format: Format | undefined): ExportTarget | undefined =>
  format === undefined || format === "html" || format === "site" ? undefined : format;

export async function renderResume(request: RenderRequest): Promise<RenderResult> {
  const held = await withStore(request.dataDir, async (r) => await r.store.readCurrent());

  if (request.resume === undefined) {
    return { choose: live(held.resumes), because: "none named" };
  }

  const found = matching(held, request.resume);
  const only = found[0];
  if (only === undefined) return { choose: live(held.resumes), because: "no match" };
  if (found.length > 1) return { choose: found, because: "ambiguous" };

  const document = compile(held, only.id, { generatedAt: new Date().toISOString() });
  // Only the resume being absent answers undefined, and it came from this
  // store.
  if (document === undefined) throw new Error(`${only.name} did not compile`);

  // No lint report: the linter is about what a machine reading a resume gets
  // out of it, and nothing here is going to a machine that reads resumes.
  if (request.format === "site") {
    const path = request.out ?? SITE_FILE_NAME;
    await writeFile(path, renderSite(document), "utf8");
    return { wrote: path, page: true };
  }

  const target = targetOf(request.format);
  if (target !== undefined) {
    const writer = WRITERS[target];
    const path = request.out ?? fileNameFor(document, writer.extension);
    await writeFile(path, writer.write(document));
    return { wrote: path, loss: lossOf(document, target) };
  }

  const html = renderHtml(document);
  const path = request.out ?? fileNameFor(document, "html");
  await writeFile(path, html, "utf8");
  return { wrote: path, report: lint({ document, html }) };
}

const TIER: Record<LintReport["tier"], string> = {
  clean: "Nothing in it trips a reader that pulls the text back out.",
  readable: "Readable, with something worth knowing:",
  "at-risk": "Something in it does not survive being read by a machine:",
};

export function verdict(report: LintReport): string {
  const findings = report.findings.map(
    (finding) =>
      `    ${finding.severity === "blocker" ? "!" : "-"} ${finding.where}: ${finding.detail}`,
  );
  return `  ${TIER[report.tier]}\n${findings.join("\n")}${findings.length === 0 ? "" : "\n"}`;
}

// Counted against this resume rather than stated as a standing disclaimer: a
// warning that appears every time is one nobody reads.
export function costs(loss: readonly Loss[]): string {
  if (loss.length === 0) return "  Everything in this resume has somewhere to go in that format.\n";

  const lines = loss.map((one) => `    - ${one.what} (${String(one.count)}): ${one.detail}`);
  return `  ${String(loss.length)} ${loss.length === 1 ? "thing does" : "things do"} not fit that format:\n${lines.join("\n")}\n`;
}

const OPENING: Record<Chooser["because"], string> = {
  "none named": "Name one of these:",
  "no match": "No resume goes by that. This store holds:",
  ambiguous: "That names more than one:",
};

export function listing(chooser: {
  choose: readonly { name: string }[];
  because: Chooser["because"];
}): string {
  const lines =
    chooser.choose.length === 0
      ? ["  This store holds no resume yet. Run `keepcv serve` and compose one."]
      : [`  ${OPENING[chooser.because]}`, "", ...chooser.choose.map((row) => `    ${row.name}`)];
  return `\n${lines.join("\n")}\n\n`;
}
