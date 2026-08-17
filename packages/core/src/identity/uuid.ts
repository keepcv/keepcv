import { type Uuid, uuidSchema } from "@keepcv/schema";
import { bytesToHex } from "@noble/hashes/utils.js";

// Declared rather than pulled in from @types/node: core's tsconfig sets
// `"types": []`, which is what stops a Node built-in reaching the browser.
declare const crypto: { getRandomValues<T extends ArrayBufferView>(array: T): T };

const COUNTER_MAX = 0xfff;

let lastMilliseconds = -1;
let counter = 0;

// Version 7: the timestamp comes first, which is what keeps insert locality.
export function newUuid(): Uuid {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const view = new DataView(bytes.buffer);
  const now = Date.now();

  if (now > lastMilliseconds) {
    lastMilliseconds = now;
    // Leaves ~3800 identifiers in this millisecond before it borrows the next.
    counter = view.getUint8(6);
  } else if (counter < COUNTER_MAX) {
    // Also the branch a backwards clock step takes, so an NTP correction cannot
    // collide with identifiers already issued.
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
