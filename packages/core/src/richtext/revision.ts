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

// The canonical form is stored as well as hashed: storing another shape leaves
// the hash unverifiable on read.
export function deriveRevision(body: RichText): DerivedRevision {
  const canonical = canonicaliseRichText(body);
  const plainText = projectPlainText(canonical);
  return {
    body: canonical,
    plainText,
    // Code points, not UTF-16 units: an emoji is not two characters wide.
    charCount: [...plainText].length,
    contentHash: contentHash(canonical as JsonValue),
  };
}
