import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "keepcv.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

function isChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value);
}

export function storedChoice(storage: Storage): ThemeChoice {
  const held = storage.getItem(STORAGE_KEY);
  return isChoice(held) ? held : "system";
}

// jsdom implements no `matchMedia`, and this runs on every mount in the suite.
function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

export function isDark(choice: ThemeChoice): boolean {
  return choice === "system" ? systemPrefersDark() : choice === "dark";
}

export function applyTheme(root: Element, choice: ThemeChoice): void {
  root.classList.toggle("dark", isDark(choice));
}

export function useTheme(storage: Storage = window.localStorage): {
  choice: ThemeChoice;
  dark: boolean;
  choose: (choice: ThemeChoice) => void;
} {
  const [choice, setChoice] = useState<ThemeChoice>(() => storedChoice(storage));

  useEffect(() => {
    applyTheme(document.documentElement, choice);
  }, [choice]);

  // Following the system means following it as it changes, not as it was on the
  // first render.
  useEffect(() => {
    if (choice !== "system" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (): void => {
      applyTheme(document.documentElement, "system");
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, [choice]);

  const choose = useCallback(
    (next: ThemeChoice) => {
      storage.setItem(STORAGE_KEY, next);
      setChoice(next);
    },
    [storage],
  );

  return { choice, dark: isDark(choice), choose };
}
