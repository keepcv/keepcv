import { SORT_KEY_DIGITS, type SortKey, sortKeySchema } from "@keepcv/schema";

const SMALLEST_DIGIT = "0";
const LARGEST_DIGIT = "z";

// A magnitude-prefixed integer part plus an optional fraction: a0...az, b00...bzz.
// Without the prefix an append halves the gap - 1000 appends gave 200-char keys.
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

  // Overflowed the digits, so the magnitude grows.
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

// `""` is an absent lower bound, `null` an absent upper one.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the branches are the specification, and naming each scatters the case analysis
function midpoint(lower: string, upper: string | null): string {
  if (upper !== null && lower >= upper) {
    throw new SortKeyError(`fractions are out of order: ${lower} >= ${upper}`);
  }
  if (lower.endsWith(SMALLEST_DIGIT) || upper?.endsWith(SMALLEST_DIGIT) === true) {
    throw new SortKeyError("a fraction must not end with the smallest digit");
  }

  // Padded past its end with the smallest digit: treating the missing one as a
  // mismatch returns "0" rather than "0G" for midpoint("", "0V").
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

  // Room between the digits, so the fraction does not have to lengthen.
  if (upperDigit - lowerDigit > 1) {
    return digitAt(Math.round((lowerDigit + upperDigit) / 2));
  }
  // Adjacent digits: borrow the upper bound's first digit if it has more...
  if (upper !== null && upper.length > 1) {
    return upper.slice(0, 1);
  }
  // ...otherwise extend by one place and recurse into the gap above.
  return digitAt(lowerDigit) + midpoint(lower.slice(1), null);
}

function validated(key: string): SortKey {
  const branded = sortKeySchema.parse(key);
  if (key === MIN_KEY) {
    throw new SortKeyError("this is the smallest representable sort key");
  }
  const fraction = key.slice(integerPart(key).length);
  if (fraction.endsWith(SMALLEST_DIGIT)) {
    // Nothing sorts before such a key without lengthening it without bound.
    throw new SortKeyError(`fractional part must not end with the smallest digit: ${key}`);
  }
  return branded;
}

function keyBefore(upper: string): SortKey {
  const int = integerPart(upper);
  if (int === MIN_KEY) return validated(int + midpoint("", upper.slice(int.length)));
  // `upper` carries a fraction, so its integer part alone already sorts before it.
  if (int < upper) return validated(int);
  const decremented = decrementInteger(int);
  if (decremented === null) throw new SortKeyError("cannot order before the smallest key");
  return validated(decremented);
}

function keyAfter(lower: string): SortKey {
  const int = integerPart(lower);
  const incremented = incrementInteger(int);
  // Incrementing only fails at the largest magnitude, where the fraction grows.
  return validated(incremented ?? int + midpoint(lower.slice(int.length), null));
}

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

// A `null` bound means unbounded on that side.
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

// Keys order by code unit and never by locale: `"Zz".localeCompare("a0")` is
// positive, and `Zz` is exactly the key a row moved above the first one takes.
export function bySortKey<T extends { sortKey: string; id: string }>(a: T, b: T): number {
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

// Bisects rather than chains, so key length stays logarithmic in `count`.
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
