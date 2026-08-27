import { writeFile } from "node:fs/promises";
import type { LintReport } from "@keepcv/ats-lint";
import { lint } from "@keepcv/ats-lint";
import { compile } from "@keepcv/core";
import { fileNameFor, renderHtml } from "@keepcv/render";
import type { Resume, Store } from "@keepcv/schema";
import { withStore } from "./store.js";

export interface RenderRequest {
  dataDir: string;
  resume: string | undefined;
  out: string | undefined;
}

export interface Chooser {
  choose: readonly Resume[];
  because: "none named" | "no match" | "ambiguous";
}

export type RenderResult = { wrote: string; report: LintReport } | Chooser;

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
  // Only the resume being absent answers undefined, and it came from this store.
  if (document === undefined) throw new Error(`${only.name} did not compile`);

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
