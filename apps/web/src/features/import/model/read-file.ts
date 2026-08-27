import type { ReactiveResume, RenderCvFile } from "@keepcv/interop";
import { fromJsonResume, fromLines, fromReactiveResume, fromRenderCv } from "@keepcv/interop";
import type { Intake } from "@keepcv/schema";
import { intakeSchema, templateFileSchema } from "@keepcv/schema";

export class UnreadableFileError extends Error {}

const FORMATS = "A PDF, a Word document, JSON Resume, Reactive Resume and RenderCV";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

const startsWith = (data: Uint8Array, magic: Uint8Array): boolean =>
  magic.every((byte, index) => data[index] === byte);

// Loaded only when one is chosen: a PDF engine is a megabyte nobody importing
// JSON should pay for, and the same goes for a YAML parser.
async function readNotJson(file: File, body: string): Promise<Intake> {
  const data = new Uint8Array(await file.arrayBuffer());
  const { docxLines, NotARenderCvError, parseRenderCv, pdfLines } = await import(
    "@keepcv/interop/files"
  );

  if (startsWith(data, PDF)) return fromLines(await pdfLines(data), "pdf");
  if (startsWith(data, ZIP)) return fromLines(docxLines(data), "docx");

  try {
    return fromRenderCv(parseRenderCv(body));
  } catch (error) {
    if (error instanceof NotARenderCvError) {
      throw new UnreadableFileError(
        `Nothing in ${file.name} looks like a resume. ${FORMATS} are the formats this reads.`,
      );
    }
    throw error;
  }
}

const isObject = (value: unknown): boolean => typeof value === "object" && value !== null;

// Named for what the reader does, not for the extension: a file called .json
// can be anything, and the shape is what decides which reader answers.
function readerFor(named: Record<string, unknown>): (value: object) => Intake {
  if ("schemaVersion" in named) {
    throw new UnreadableFileError(
      "That is a whole-store backup. Load it from Your data instead, which puts every row back exactly as it was.",
    );
  }
  if (templateFileSchema.safeParse(named).success) {
    throw new UnreadableFileError(
      "That is a design, not a resume. Start a design from it on Templates instead.",
    );
  }
  // Before the JSON Resume check, which `basics` alone would also answer.
  if (isObject(named["sections"]) || "customSections" in named) {
    return (value) => fromReactiveResume(value as ReactiveResume);
  }
  // YAML is a superset of JSON, so this format turns up written either way.
  if (isObject(named["cv"])) return (value) => fromRenderCv(value as RenderCvFile);
  if ("basics" in named || "work" in named || "education" in named) return fromJsonResume;

  throw new UnreadableFileError(
    `Nothing in that file looks like a resume. ${FORMATS} are the formats this reads.`,
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
    // Not JSON, so it is read from bytes or as YAML. The extension is not
    // consulted: a resume saved as .txt is still a PDF if it starts like one.
    return intakeSchema.parse(await readNotJson(file, body));
  }

  if (!isObject(parsed)) {
    throw new UnreadableFileError("That file is not a resume this build can read.");
  }
  return intakeSchema.parse(readerFor(parsed as Record<string, unknown>)(parsed as object));
}
