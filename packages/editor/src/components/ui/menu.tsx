import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = wrapper.current?.querySelector("button")?.getBoundingClientRect();
    const menu = panel.current?.getBoundingClientRect();
    if (!anchor || !menu) return;
    setPosition({
      left: Math.max(
        8,
        Math.min(
          placement === "top-start" ? anchor.left : anchor.right - menu.width,
          innerWidth - menu.width - 8,
        ),
      ),
      top: Math.max(
        8,
        Math.min(
          placement === "top-start" ? anchor.top - menu.height - 8 : anchor.bottom + 4,
          innerHeight - menu.height - 8,
        ),
      ),
    });
  }, [open, placement]);

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
    const onMove = (event: Event) => {
      if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
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
            ref={panel}
            role="menu"
            aria-label={label}
            style={{
              left: position?.left,
              top: position?.top,
              visibility: position === null ? "hidden" : undefined,
            }}
            className="fixed z-30 w-56 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border border-line bg-surface-raised py-1.5 shadow-overlay"
          >
            {children}
          </div>
        </CloseContext.Provider>
      ) : null}
    </div>
  );
}
