import { fromJsonResume } from "@keepcv/interop";
import type { Intake } from "@keepcv/schema";
import { intakeSchema } from "@keepcv/schema";

export class UnreadableFileError extends Error {}

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
    throw new UnreadableFileError(`${file.name} is not JSON this build can read.`);
  }

  return intakeSchema.parse(readerFor(parsed)(parsed as object));
}
