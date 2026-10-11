import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

// The first message per path: a field shows one error, and Zod reports every
// failing rule on a union.
export function fieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    errors[issue.path.map(String).join(".")] ??= issue.message;
  }
  return errors;
}

export function trimmed(value: string): string | null {
  const text = value.trim();
  return text === "" ? null : text;
}

export interface Difference {
  label: string;
  mine: string;
  theirs: string;
}

// Only the fields that actually differ, with one nobody filled in named rather
// than shown as a gap between two labels.
export function differing(
  fields: readonly { label: string; mine: string; theirs: string }[],
): Difference[] {
  return fields
    .filter((field) => field.mine !== field.theirs)
    .map(({ label, mine, theirs }) => ({
      label,
      mine: mine === "" ? "empty" : mine,
      theirs: theirs === "" ? "empty" : theirs,
    }));
}
