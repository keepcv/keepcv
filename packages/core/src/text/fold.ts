const MARKS = /\p{M}+/gu;

// The combining mark NFKD leaves has to be dropped, not left to separate the
// word: "crepe" otherwise fails to match the spelling with a circumflex.
export function fold(value: string): string {
  return value.normalize("NFKD").replace(MARKS, "").toLowerCase();
}
