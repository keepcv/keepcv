import { type ContentHash, contentHashSchema } from "@keepcv/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalJson, type JsonValue } from "./canonical-json.js";

// SHA-256 over the canonical JSON encoding (data-model.md #5). Callers must
// persist the same value they hashed - hashing a canonicalised rich-text body
// and storing the raw one makes the stored hash unverifiable on read.
export function contentHash(value: JsonValue): ContentHash {
  return contentHashSchema.parse(bytesToHex(sha256(utf8ToBytes(canonicalJson(value)))));
}
