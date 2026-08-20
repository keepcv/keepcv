import { generateKeyBetween } from "@keepcv/core";

// A new row goes last: inserting at the top would reorder a list the user did
// not touch.
export function nextSortKey(rows: readonly { sortKey: string }[]): string {
  const last = rows
    .map((row) => row.sortKey)
    .sort((a, b) => a.localeCompare(b))
    .at(-1);
  return generateKeyBetween(last ?? null, null);
}
