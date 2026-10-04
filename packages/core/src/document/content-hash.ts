import type { ContentHash, ResumeDocument } from "@keepcv/schema";
import type { JsonValue } from "../hashing/canonical-json.js";
import { contentHash } from "../hashing/content-hash.js";

export function documentContentHash(document: ResumeDocument): ContentHash {
  return contentHash({
    ...document,
    meta: { ...document.meta, generatedAt: "" },
  } as unknown as JsonValue);
}
