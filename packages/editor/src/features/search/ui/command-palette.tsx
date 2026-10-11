import type { Store } from "@keepcv/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "../../../components/icon/icon.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Kbd } from "../../../components/ui/kbd.js";
import { cn } from "../../../lib/cn.js";
import { type PaletteItem, paletteItems } from "../model/palette.js";

function Row({
  item,
  active,
  onChoose,
}: {
  item: PaletteItem;
  active: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(event) => {
        // The input keeps focus, so the click is not lost to a blur first.
        event.preventDefault();
      }}
      onClick={onChoose}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
        active ? "bg-brand-soft text-brand-text" : "text-text hover:bg-surface-hover",
      )}
    >
      <Icon name={item.icon} size="sm" className={active ? undefined : "text-text-subtle"} />
      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
      {item.context === undefined ? null : (
        <span className="max-w-48 shrink-0 truncate text-xs text-text-subtle">{item.context}</span>
      )}
    </button>
  );
}

export function CommandPalette({ store, onClose }: { store: Store; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);

  const items = useMemo(() => paletteItems(store, query), [store, query]);
  const active = items[Math.min(at, items.length - 1)];

  function choose(item: PaletteItem): void {
    onClose();
    void navigate({
      to: item.to,
      ...(item.params === undefined ? {} : { params: item.params }),
      ...(item.search === undefined ? {} : { search: item.search }),
    });
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setAt((held) => (held + step + items.length) % Math.max(items.length, 1));
      return;
    }
    if (event.key === "Enter" && active !== undefined) {
      event.preventDefault();
      choose(active);
    }
  }

  let group = "";

  return (
    <Dialog title="Command palette" size="lg" onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2">
        <Icon name="search" size="sm" className="text-text-subtle" />
        {/* Opened by an explicit keystroke and exists to be typed into. */}
        <input
          autoFocus
          value={query}
          aria-label="Search the store or jump to a screen"
          placeholder="Search the store, or jump to a screen"
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          onChange={(event) => {
            setQuery(event.target.value);
            setAt(0);
          }}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent py-1 text-sm text-text outline-none placeholder:text-text-subtle"
        />
      </div>

      <div
        id="palette-results"
        role="listbox"
        aria-label="Results"
        className="max-h-96 overflow-y-auto p-2"
      >
        {items.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-text-muted">
            Nothing matches "{query}".
          </p>
        ) : (
          items.map((item, index) => {
            const heading = item.group === group ? null : item.group;
            group = item.group;
            return (
              <div key={item.key}>
                {heading === null ? null : (
                  <p className="px-2.5 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-subtle first:pt-1">
                    {heading}
                  </p>
                )}
                <Row
                  item={item}
                  active={index === Math.min(at, items.length - 1)}
                  onChoose={() => {
                    choose(item);
                  }}
                />
              </div>
            );
          })
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-line-subtle px-4 py-2 text-xs text-text-subtle">
        <span className="flex items-center gap-1">
          <Kbd>up</Kbd>
          <Kbd>down</Kbd> to move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>enter</Kbd> to open
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> to close
        </span>
      </footer>
    </Dialog>
  );
}
