import { writeFile } from "node:fs/promises";
import { compile } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { fileNameFor, renderHtml } from "@keepcv/render";
import type { Resume, Store } from "@keepcv/schema";

export interface RenderRequest {
  dataDir: string;
  resume: string | undefined;
  out: string | undefined;
}

export interface Chooser {
  choose: readonly Resume[];
  because: "none named" | "no match" | "ambiguous";
}

export type RenderResult = { wrote: string } | Chooser;

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
  const store = openLocalStore({ dataDir: request.dataDir });
  try {
    await store.migrate();
    const ownerId = await store.ensureLocalOwner();
    const held = await runAsOwner(ownerId, () =>
      store.unitOfWork.run(async (repositories) => await repositories.store.readCurrent()),
    );

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

    const path = request.out ?? fileNameFor(document, "html");
    await writeFile(path, renderHtml(document), "utf8");
    return { wrote: path };
  } finally {
    await store.close();
  }
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
