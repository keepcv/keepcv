import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";
import { Button } from "./button.js";

const CloseContext = createContext<() => void>(() => undefined);

export function MenuItem({
  icon,
  tone = "neutral",
  disabled,
  onClick,
  children,
}: {
  icon?: GlyphName;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const close = useContext(CloseContext);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close();
        onClick();
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
        tone === "danger"
          ? "text-critical-text hover:bg-critical-soft"
          : "text-text hover:bg-surface-hover",
      )}
    >
      {icon === undefined ? null : <Icon name={icon} size="sm" className="text-text-subtle" />}
      {children}
    </button>
  );
}

export function Menu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // On the document rather than the wrapper: Escape has to close the menu from
  // inside it, and a handler on a plain div is an interactive static element.
  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || wrapper.current?.contains(event.target) === true) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <Button
        tone="ghost"
        size="sm"
        icon="more"
        label={label}
        onClick={() => {
          setOpen(!open);
        }}
      />
      {open ? (
        <CloseContext.Provider
          value={() => {
            setOpen(false);
          }}
        >
          <div
            role="menu"
            aria-label={label}
            className="absolute right-0 z-30 mt-1 min-w-44 overflow-hidden rounded-lg border border-line bg-surface-raised py-1 shadow-overlay"
          >
            {children}
          </div>
        </CloseContext.Provider>
      ) : null}
    </div>
  );
}
