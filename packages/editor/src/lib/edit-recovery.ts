export function readEdit(key: string): unknown {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? undefined : (JSON.parse(value) as unknown);
  } catch {
    return undefined;
  }
}

export function keepEdit(key: string, value: unknown): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A storage refusal must not stop the server save or discard typed text.
  }
}

export function forgetEdit(key: string, value: unknown): void {
  if (JSON.stringify(readEdit(key)) === JSON.stringify(value)) keepEdit(key, undefined);
}
