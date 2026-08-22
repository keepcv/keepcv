import type { ResumeDocument } from "@keepcv/schema";

const named = (text: string | undefined): string | undefined =>
  text === undefined || text.trim() === "" ? undefined : text.trim();

// Both the window title and the filename a browser offers when it prints, so it
// is the name a reader of the file sees rather than an internal label.
export function documentTitle(document: ResumeDocument): string {
  const fullName = named(document.header.fullName);
  const resumeName = named(document.meta.resumeName) ?? "Resume";
  return fullName === undefined ? resumeName : `${fullName} - ${resumeName}`;
}

// Marks left by NFKD are dropped rather than transliterated, so an accented
// name files as plain letters and a script that does not decompose keeps its own.
function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replaceAll(/\p{Mark}+/gu, "")
    .replaceAll(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replaceAll(/^-+|-+$/g, "")
    .toLowerCase();
}

export function fileNameFor(document: ResumeDocument, extension: string): string {
  const stem = slug(documentTitle(document));
  return `${stem === "" ? "resume" : stem}.${extension}`;
}
