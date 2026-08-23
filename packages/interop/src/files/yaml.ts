import { parse } from "yaml";
import type { RenderCvFile } from "../rendercv.js";

export class NotARenderCvError extends Error {}

// Here rather than on the package's main entry for the reason the PDF and Word
// readers are: it is the one thing in reading this format that needs a parser,
// and `fromRenderCv` reasons about the object it answers.
export function parseRenderCv(source: string): RenderCvFile {
  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch {
    throw new NotARenderCvError("That file is not readable as YAML.");
  }

  if (typeof parsed !== "object" || parsed === null || !("cv" in parsed)) {
    throw new NotARenderCvError("That YAML file has no `cv` in it, so it is not a RenderCV file.");
  }
  return parsed as RenderCvFile;
}
