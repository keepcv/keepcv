import { fromJsonResume, fromLines } from "@keepcv/interop";
import type { Intake } from "@keepcv/schema";
import { intakeSchema } from "@keepcv/schema";

export class UnreadableFileError extends Error {}

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

const startsWith = (data: Uint8Array, magic: Uint8Array): boolean =>
  magic.every((byte, index) => data[index] === byte);

// Loaded only when one is chosen: a PDF engine is a megabyte nobody importing
// JSON should pay for.
async function readBytes(file: File): Promise<Intake> {
  const data = new Uint8Array(await file.arrayBuffer());
  const { docxLines, pdfLines } = await import("@keepcv/interop/files");

  if (startsWith(data, PDF)) return fromLines(await pdfLines(data), "pdf");
  if (startsWith(data, ZIP)) return fromLines(docxLines(data), "docx");
  throw new UnreadableFileError(
    `${file.name} is not a PDF, a Word document or a JSON resume, which are the three this build reads.`,
  );
}

// Named for what the reader does, not for the extension: a file called .json
// can be anything, and the shape is what decides which reader answers.
function readerFor(parsed: unknown): (value: object) => Intake {
  if (typeof parsed !== "object" || parsed === null) {
    throw new UnreadableFileError("That file is not a resume this build can read.");
  }
  const named = parsed as Record<string, unknown>;
  if ("schemaVersion" in named) {
    throw new UnreadableFileError(
      "That is a whole-store backup. Load it from Your data instead, which puts every row back exactly as it was.",
    );
  }
  if ("basics" in named || "work" in named || "education" in named) return fromJsonResume;
  throw new UnreadableFileError(
    "Nothing in that file looks like a resume. JSON Resume is the format this build reads.",
  );
}

// The file never leaves the tab: what the store is asked to write is the
// reviewed intake, not the resume it came out of.
export async function readFile(file: File): Promise<Intake> {
  const body = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Not JSON, so it is one of the two formats read from bytes. The extension
    // is not consulted: a resume saved as .txt is still a PDF if it starts
    // like one.
    return intakeSchema.parse(await readBytes(file));
  }

  return intakeSchema.parse(readerFor(parsed)(parsed as object));
}
