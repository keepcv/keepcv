import { SORT_KEY_DIGITS, type SortKey, sortKeySchema } from "@keepcv/schema";

const SMALLEST_DIGIT = "0";
const LARGEST_DIGIT = "z";

/**
 * A sort key is a magnitude-prefixed integer part followed by an optional
 * fractional part:
 *
 *     a0   a1   a2 … az   b00  b01 … bzz   c000 …
 *     └┬┘                 └─┬┘
 *      │                    └─ "b" means a two-digit integer
 *      └─ "a" means a one-digit integer
 *
 * The magnitude prefix is what keeps *appending* cheap. Without it, each
 * append can only consume half the remaining gap above the previous key, so
 * key length grows linearly — a thousand appends produced two-hundred-character
 * keys. With it, appending walks the integer part and length grows
 * logarithmically instead.
 *
 * Lower-case heads encode non-negative integers, upper-case heads negative
 * ones, so inserting before the first item stays cheap too.
 */
const MIN_KEY = `A${SMALLEST_DIGIT.repeat(26)}`;
const FIRST_KEY = `a${SMALLEST_DIGIT}`;

export class SortKeyError extends Error {
  override readonly name = "SortKeyError";
}

function digitIndex(char: string): number {
  const index = SORT_KEY_DIGITS.indexOf(char);
  if (index < 0) throw new SortKeyError(`not a base-62 digit: ${JSON.stringify(char)}`);
  return index;
}

function digitAt(value: number): string {
  const char = SORT_KEY_DIGITS[value];
  if (char === undefined) throw new SortKeyError(`digit out of range: ${value}`);
  return char;
}

/** How many digits follow a given magnitude head. */
function integerLength(head: string): number {
  if (head >= "a" && head <= "z") return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
  if (head >= "A" && head <= "Z") return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new SortKeyError(`invalid sort key magnitude: ${JSON.stringify(head)}`);
}

function integerPart(key: string): string {
  const length = integerLength(key.slice(0, 1));
  if (length > key.length) throw new SortKeyError(`sort key is truncated: ${key}`);
  return key.slice(0, length);
}

function assertWellFormedInteger(int: string): void {
  if (int.length !== integerLength(int.slice(0, 1))) {
    throw new SortKeyError(`malformed integer part: ${int}`);
  }
}

function incrementInteger(int: string): string | null {
  assertWellFormedInteger(int);
  const head = int.slice(0, 1);
  const digits = int.slice(1).split("");

  let carry = true;
  for (let i = digits.length - 1; carry && i >= 0; i--) {
    const next = digitIndex(digits[i] ?? "") + 1;
    if (next === SORT_KEY_DIGITS.length) {
      digits[i] = SMALLEST_DIGIT;
    } else {
      digits[i] = digitAt(next);
      carry = false;
    }
  }
  if (!carry) return head + digits.join("");

  // The digits overflowed, so the magnitude has to grow.
  if (head === "Z") return FIRST_KEY;
  if (head === "z") return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > "a") digits.push(SMALLEST_DIGIT);
  else digits.pop();
  return nextHead + digits.join("");
}

function decrementInteger(int: string): string | null {
  assertWellFormedInteger(int);
  const head = int.slice(0, 1);
  const digits = int.slice(1).split("");

  let borrow = true;
  for (let i = digits.length - 1; borrow && i >= 0; i--) {
    const next = digitIndex(digits[i] ?? "") - 1;
    if (next === -1) {
      digits[i] = LARGEST_DIGIT;
    } else {
      digits[i] = digitAt(next);
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join("");

  if (head === "a") return `Z${LARGEST_DIGIT}`;
  if (head === "A") return null;
  const previousHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (previousHead < "Z") digits.push(LARGEST_DIGIT);
  else digits.pop();
  return previousHead + digits.join("");
}

/**
 * A fractional string strictly between `lower` and `upper`.
 * `lower` is `""` for "no lower bound"; `upper` is `null` for "no upper bound".
 */
// This is a recursive numeric algorithm whose branches *are* the
// specification. Splitting it into named helpers would scatter the case
// analysis without making any single case easier to verify.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: see above
function midpoint(lower: string, upper: string | null): string {
  if (upper !== null && lower >= upper) {
    throw new SortKeyError(`fractions are out of order: ${lower} >= ${upper}`);
  }
  if (lower.endsWith(SMALLEST_DIGIT) || upper?.endsWith(SMALLEST_DIGIT) === true) {
    throw new SortKeyError("a fraction must not end with the smallest digit");
  }

  // A shared prefix carries through untouched; recurse on what differs.
  //
  // `lower` is padded with the smallest digit past its end, because a shorter
  // fraction is numerically the same as itself followed by zeroes. Treating a
  // missing digit as "no match" instead ends the walk early and can return a
  // fraction ending in the smallest digit — e.g. midpoint("", "0V") yielding
  // "0" rather than "0G" — which is exactly the key shape that cannot be
  // inserted before.
  if (upper !== null) {
    let shared = 0;
    while (shared < upper.length && (lower[shared] ?? SMALLEST_DIGIT) === upper[shared]) {
      shared++;
    }
    if (shared > 0) {
      return upper.slice(0, shared) + midpoint(lower.slice(shared), upper.slice(shared));
    }
  }

  const lowerDigit = lower.length === 0 ? 0 : digitIndex(lower.slice(0, 1));
  const upperDigit =
    upper !== null && upper.length > 0 ? digitIndex(upper.slice(0, 1)) : SORT_KEY_DIGITS.length;

  // Room for a digit strictly between them: length stays the same.
  if (upperDigit - lowerDigit > 1) {
    return digitAt(Math.round((lowerDigit + upperDigit) / 2));
  }
  // Adjacent digits: either borrow the upper bound's first digit...
  if (upper !== null && upper.length > 1) {
    return upper.slice(0, 1);
  }
  // ...or extend by one place and recurse into the gap above.
  return digitAt(lowerDigit) + midpoint(lower.slice(1), null);
}

/**
 * Validate a key and return it branded.
 *
 * `@keepcv/schema` owns the lexical contract (non-empty, base-62 only) because
 * that is what storage and the wire format guarantee. The structural rules
 * below belong to this algorithm, so they live here.
 */
function validated(key: string): SortKey {
  const branded = sortKeySchema.parse(key);
  if (key === MIN_KEY) {
    throw new SortKeyError("this is the smallest representable sort key");
  }
  const fraction = key.slice(integerPart(key).length);
  if (fraction.endsWith(SMALLEST_DIGIT)) {
    // Such a key leaves no room to insert immediately before it without
    // lengthening the key without bound.
    throw new SortKeyError(`fractional part must not end with the smallest digit: ${key}`);
  }
  return branded;
}

/** A key ordering before `upper`, with no lower bound. */
function keyBefore(upper: string): SortKey {
  const int = integerPart(upper);
  if (int === MIN_KEY) return validated(int + midpoint("", upper.slice(int.length)));
  // A bare integer part means `upper` has a fraction, so the integer alone
  // already sorts before it and no borrowing is needed.
  if (int < upper) return validated(int);
  const decremented = decrementInteger(int);
  if (decremented === null) throw new SortKeyError("cannot order before the smallest key");
  return validated(decremented);
}

/** A key ordering after `lower`, with no upper bound. */
function keyAfter(lower: string): SortKey {
  const int = integerPart(lower);
  const incremented = incrementInteger(int);
  // Incrementing only fails at the largest magnitude, where the fraction has
  // to grow instead.
  return validated(incremented ?? int + midpoint(lower.slice(int.length), null));
}

/** A key ordering strictly between two bounded neighbours. */
function keyWithin(lower: string, upper: string): SortKey {
  const lowerInt = integerPart(lower);
  const upperInt = integerPart(upper);
  if (lowerInt === upperInt) {
    return validated(
      lowerInt + midpoint(lower.slice(lowerInt.length), upper.slice(upperInt.length)),
    );
  }
  const incremented = incrementInteger(lowerInt);
  if (incremented === null) throw new SortKeyError("cannot order after the largest key");
  if (incremented < upper) return validated(incremented);
  return validated(lowerInt + midpoint(lower.slice(lowerInt.length), null));
}

/**
 * Generate a sort key ordering strictly between two neighbours.
 *
 * Pass `null` for either bound to insert at the start or end of a list; both
 * `null` produces the first key in an empty list. A move therefore writes one
 * row (data-model.md §3.5).
 */
export function generateKeyBetween(
  lower: SortKey | string | null,
  upper: SortKey | string | null,
): SortKey {
  if (lower !== null) validated(lower);
  if (upper !== null) validated(upper);
  if (lower !== null && upper !== null && lower >= upper) {
    throw new SortKeyError(`keys are out of order: ${lower} >= ${upper}`);
  }

  if (lower === null) {
    return upper === null ? validated(FIRST_KEY) : keyBefore(upper);
  }
  if (upper === null) return keyAfter(lower);
  return keyWithin(lower, upper);
}

/**
 * Generate `count` ascending keys between two neighbours.
 *
 * Used when seeding an ordered list and when an import creates many siblings
 * at once. Bounded insertions bisect so key length stays logarithmic in
 * `count`; unbounded ones walk the integer part, which is already logarithmic.
 */
export function generateNKeysBetween(
  lower: SortKey | string | null,
  upper: SortKey | string | null,
  count: number,
): SortKey[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new SortKeyError(`count must be a non-negative integer, received ${count}`);
  }
  if (count === 0) return [];
  if (count === 1) return [generateKeyBetween(lower, upper)];

  if (upper === null) {
    let key = generateKeyBetween(lower, null);
    const keys: SortKey[] = [key];
    for (let i = 1; i < count; i++) {
      key = generateKeyBetween(key, null);
      keys.push(key);
    }
    return keys;
  }

  if (lower === null) {
    let key = generateKeyBetween(null, upper);
    const keys: SortKey[] = [key];
    for (let i = 1; i < count; i++) {
      key = generateKeyBetween(null, key);
      keys.push(key);
    }
    return keys.reverse();
  }

  const half = Math.floor(count / 2);
  const middle = generateKeyBetween(lower, upper);
  return [
    ...generateNKeysBetween(lower, middle, half),
    middle,
    ...generateNKeysBetween(middle, upper, count - half - 1),
  ];
}
