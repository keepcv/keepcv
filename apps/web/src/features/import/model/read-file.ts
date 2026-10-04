import type { ReactiveResume, RenderCvFile } from "@keepcv/interop";
import { fromJsonResume, fromLines, fromReactiveResume, fromRenderCv } from "@keepcv/interop";
import type { Intake } from "@keepcv/schema";
import { intakeSchema, templateFileSchema } from "@keepcv/schema";

export class UnreadableFileError extends Error {}

const FORMATS = "A PDF, a Word document, JSON Resume, Reactive Resume and RenderCV";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const MAX_FILE_BYTES = 16 * 1024 * 1024;

const startsWith = (data: Uint8Array, magic: Uint8Array): boolean =>
  magic.every((byte, index) => data[index] === byte);

async function readNotJson(body: string): Promise<Intake> {
  const { NotARenderCvError, parseRenderCv } = await import("@keepcv/interop/files");

  try {
    return fromRenderCv(parseRenderCv(body));
  } catch (error) {
    if (error instanceof NotARenderCvError) {
      throw new UnreadableFileError(
        `Nothing in that file looks like a resume. ${FORMATS} are the formats this reads.`,
      );
    }
    throw error;
  }
}

async function readDocx(file: File, signal?: AbortSignal): Promise<Intake> {
  const bytes = await file.arrayBuffer();
  if (signal?.aborted === true) throw new UnreadableFileError("Reading was cancelled.");
  const worker = new Worker(new URL("./read-docx.worker.ts", import.meta.url), { type: "module" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<Intake>((resolve, reject) => {
      abort = () => reject(new UnreadableFileError("Reading was cancelled."));
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(
        () => reject(new UnreadableFileError("That Word document took too long to read.")),
        30_000,
      );
      worker.onmessage = (event: MessageEvent<{ intake?: unknown; error?: string }>) => {
        if (event.data.error !== undefined) reject(new UnreadableFileError(event.data.error));
        else {
          try {
            resolve(intakeSchema.parse(event.data.intake));
          } catch (error) {
            reject(error);
          }
        }
      };
      worker.onerror = () =>
        reject(new UnreadableFileError("That Word document could not be read."));
      worker.postMessage(bytes, [bytes]);
    });
  } finally {
    clearTimeout(timer);
    if (abort !== undefined) signal?.removeEventListener("abort", abort);
    worker.terminate();
  }
}

const isObject = (value: unknown): boolean => typeof value === "object" && value !== null;

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
  if (isObject(named["sections"]) || "customSections" in named) {
    return (value) => fromReactiveResume(value as ReactiveResume);
  }
  if (isObject(named["cv"])) return (value) => fromRenderCv(value as RenderCvFile);
  if ("basics" in named || "work" in named || "education" in named) return fromJsonResume;

  throw new UnreadableFileError(
    `Nothing in that file looks like a resume. ${FORMATS} are the formats this reads.`,
  );
}

export async function readFile(file: File, signal?: AbortSignal): Promise<Intake> {
  if (file.size > MAX_FILE_BYTES)
    throw new UnreadableFileError("Choose a resume file of at most 16 MiB.");
  const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (startsWith(magic, ZIP)) return await readDocx(file, signal);
  if (startsWith(magic, PDF)) {
    const { pdfLines } = await import("@keepcv/interop/files");
    return intakeSchema.parse(
      fromLines(await pdfLines(new Uint8Array(await file.arrayBuffer())), "pdf"),
    );
  }
  const body = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return intakeSchema.parse(await readNotJson(body));
  }

  if (!isObject(parsed)) {
    throw new UnreadableFileError("That file is not a resume this build can read.");
  }
  return intakeSchema.parse(readerFor(parsed as Record<string, unknown>)(parsed as object));
}
