import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";
import { Button } from "./button.js";

const CloseContext = createContext<() => void>(() => undefined);

export function MenuItem({
  icon,
  tone = "neutral",
  disabled,
  checked,
  onClick,
  children,
}: {
  icon?: GlyphName;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  checked?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const close = useContext(CloseContext);
  const state =
    checked === undefined
      ? { role: "menuitem" as const }
      : { role: "menuitemcheckbox" as const, "aria-checked": checked };

  return (
    <button
      type="button"
      {...state}
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
      <span className="min-w-0 flex-1">{children}</span>
      {checked === true ? <Icon name="confirm" size="sm" /> : null}
    </button>
  );
}

export function Menu({
  label,
  children,
  icon = "more",
  placement = "bottom-end",
}: {
  label: string;
  children: ReactNode;
  icon?: GlyphName;
  placement?: "bottom-end" | "top-start";
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    wrapper.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const items = () => [
      ...(wrapper.current?.querySelectorAll<HTMLButtonElement>(
        'button[role^="menuitem"]:not([disabled])',
      ) ?? []),
    ];
    items()[0]?.focus();
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!wrapper.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = items();
      const index = buttons.findIndex((button) => button === document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={wrapper} className="relative">
      <Button
        tone="ghost"
        size="sm"
        icon={icon}
        expanded={open}
        label={label}
        onClick={() => {
          setOpen(!open);
        }}
      />
      {open ? (
        <CloseContext.Provider value={close}>
          <div
            role="menu"
            aria-label={label}
            className={cn(
              "absolute z-30 min-w-56 overflow-hidden rounded-xl border border-line bg-surface-raised py-1.5 shadow-overlay",
              placement === "top-start" ? "bottom-full left-0 mb-2" : "right-0 mt-1",
            )}
          >
            {children}
          </div>
        </CloseContext.Provider>
      ) : null}
    </div>
  );
}
