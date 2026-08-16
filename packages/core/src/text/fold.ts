const MARKS = /\p{M}+/gu;

// One spelling for matching on: lowercase, with accents removed. NFKD splits an
// accented letter into a letter and a combining mark, and the mark has to be
// dropped rather than left to separate the word - "crepe" would otherwise fail
// to match a word spelled with a circumflex, which is the one case accent
// folding exists for.
export function fold(value: string): string {
  return value.normalize("NFKD").replace(MARKS, "").toLowerCase();
}
