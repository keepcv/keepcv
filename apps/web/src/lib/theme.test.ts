import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTheme, isDark, storedChoice } from "./theme.js";

function storage(entries: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(entries));
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value);
    },
    removeItem: (key) => {
      held.delete(key);
    },
    clear: () => {
      held.clear();
    },
    key: () => null,
    get length() {
      return held.size;
    },
  };
}

describe("theme", () => {
  it("falls back to following the system when nothing is stored", () => {
    expect(storedChoice(storage())).toBe("system");
  });

  // A key that is not one of the three would otherwise reach `classList` and
  // leave the page in whichever scheme it was already in.
  it("ignores a stored value that is not a choice", () => {
    expect(storedChoice(storage({ "keepcv.theme": "sepia" }))).toBe("system");
  });

  it("reads an explicit choice back", () => {
    expect(storedChoice(storage({ "keepcv.theme": "dark" }))).toBe("dark");
  });

  it("adds and removes the class the stylesheet keys off", () => {
    const root = document.createElement("html");

    applyTheme(root, "dark");
    expect(root.classList.contains("dark")).toBe(true);

    applyTheme(root, "light");
    expect(root.classList.contains("dark")).toBe(false);
  });

  // jsdom implements no `matchMedia`, so an unguarded call throws on every
  // mount.
  it("treats the system as light where matchMedia is missing", () => {
    expect(isDark("system")).toBe(false);
  });

  // The inline script in index.html runs before the bundle and cannot import
  // this module, so the key and the choice vocabulary live in both places.
  it("agrees with the pre-paint script in index.html", () => {
    // `import.meta.url` is an http URL under the jsdom environment.
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(html).toContain('localStorage.getItem("keepcv.theme")');
    expect(html).toContain('choice === "dark"');
    expect(html).toContain('choice === "system"');
    expect(html).toContain('classList.add("dark")');
  });
});
