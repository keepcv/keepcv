import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "../../../components/icon/icon.js";

// Every keystroke answers from cached data, so the URL is updated as you type
// and replaced rather than pushed - a search is one history entry, not thirty.
export function SearchField({ query = "", archived }: { query?: string; archived?: boolean }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(query);

  useEffect(() => {
    setValue(query);
  }, [query]);

  return (
    <search className="relative w-full max-w-xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Icon
          name="search"
          size="sm"
          className="pointer-events-none absolute left-3 top-2.5 text-text-subtle"
        />
        <input
          type="search"
          name="q"
          value={value}
          aria-label="Search records and points"
          placeholder="Search records and points"
          onChange={(event) => {
            setValue(event.target.value);
            void navigate({
              to: "/search",
              search: { q: event.target.value, ...(archived === true ? { archived } : {}) },
              replace: true,
            });
          }}
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-subtle focus:border-brand"
        />
      </form>
    </search>
  );
}
