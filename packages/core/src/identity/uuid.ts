import { type Uuid, uuidSchema } from "@keepcv/schema";
import { bytesToHex } from "@noble/hashes/utils.js";

// The one host API this package touches. Declared rather than pulled in from
// @types/node, because core's tsconfig sets `"types": []` - that is what stops
// a Node built-in reaching a package the browser also runs.
declare const crypto: { getRandomValues<T extends ArrayBufferView>(array: T): T };

const COUNTER_MAX = 0xfff;

let lastMilliseconds = -1;
let counter = 0;

// Identifiers are minted before the server has heard of the row, so an
// optimistic write is the real write (application-structure.md #4). Version 7
// puts the timestamp first, which is what keeps insert locality and makes an
// (updated_at, id) cursor stable.
export function newUuid(): Uuid {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const view = new DataView(bytes.buffer);
  const now = Date.now();

  if (now > lastMilliseconds) {
    lastMilliseconds = now;
    // Seeded into the low byte, leaving ~3800 identifiers in this millisecond
    // before the counter has to borrow from the next one.
    counter = view.getUint8(6);
  } else if (counter < COUNTER_MAX) {
    // Also the branch a clock that steps backwards takes, so identifiers stay
    // monotonic across an NTP correction rather than colliding with issued ones.
    counter++;
  } else {
    lastMilliseconds++;
    counter = view.getUint8(6);
  }

  view.setUint32(0, Math.floor(lastMilliseconds / 0x1_0000));
  view.setUint16(4, lastMilliseconds % 0x1_0000);
  view.setUint16(6, 0x7000 | counter);
  view.setUint8(8, 0x80 | (view.getUint8(8) & 0x3f));

  const hex = bytesToHex(bytes);
  return uuidSchema.parse(
    [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join(
      "-",
    ),
  );
}
