import type { ContentHash, RichText } from "@keepcv/schema";
import type { JsonValue } from "../hashing/canonical-json.js";
import { contentHash } from "../hashing/content-hash.js";
import { canonicaliseRichText } from "./canonicalise.js";
import { projectPlainText } from "./plain-text.js";

export interface DerivedRevision {
  body: RichText;
  plainText: string;
  charCount: number;
  contentHash: ContentHash;
}

// Everything a phrasing revision holds beside the text the user typed, derived in
// one place so a body written in the editor and the same body arriving in an
// import cannot end up with different hashes. The canonical form is what gets
// stored as well as what gets hashed - hashing one shape and storing another
// leaves the stored hash unverifiable on read.
export function deriveRevision(body: RichText): DerivedRevision {
  const canonical = canonicaliseRichText(body);
  const plainText = projectPlainText(canonical);
  return {
    body: canonical,
    plainText,
    // Code points rather than UTF-16 units: a length budget counts what a reader
    // sees, and an emoji is not two characters wide.
    charCount: [...plainText].length,
    contentHash: contentHash(canonical as JsonValue),
  };
}
