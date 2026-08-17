import { type ContentHash, contentHashSchema } from "@keepcv/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalJson, type JsonValue } from "./canonical-json.js";

// Callers must persist the same value they hashed: storing the raw body and
// hashing the canonical one leaves the stored hash unverifiable on read.
export function contentHash(value: JsonValue): ContentHash {
  return contentHashSchema.parse(bytesToHex(sha256(utf8ToBytes(canonicalJson(value)))));
}
