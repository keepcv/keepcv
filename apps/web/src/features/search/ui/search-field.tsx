import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// Every keystroke answers from cached data, so the URL is updated as you type
// and replaced rather than pushed - a search is one history entry, not thirty.
export function SearchField({ query = "" }: { query?: string }) {
  const navigate = useNavigate();
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(query);

  useEffect(() => {
    setValue(query);
  }, [query]);

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        field.current?.focus();
      }
    };
    window.addEventListener("keydown", focusOnSlash);
    return () => {
      window.removeEventListener("keydown", focusOnSlash);
    };
  }, []);

  return (
    <search className="relative w-full max-w-md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: "/search", search: { q: value } });
        }}
      >
        <input
          ref={field}
          type="search"
          name="q"
          value={value}
          aria-label="Search records and points"
          placeholder="Search records and points"
          onChange={(event) => {
            setValue(event.target.value);
            void navigate({ to: "/search", search: { q: event.target.value }, replace: true });
          }}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2 top-1.5 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-400">
          /
        </kbd>
      </form>
    </search>
  );
}
