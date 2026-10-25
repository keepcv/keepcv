import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "./button.js";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  describedBy,
  size = "md",
  onClose,
  children,
}: {
  title: string;
  describedBy?: string;
  size?: "md" | "lg" | "full";
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    const held = document.activeElement;
    // Focusing Close unconditionally swallowed typing in the palette's field.
    if (panel.current?.contains(held) !== true) {
      panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
    return () => {
      if (held instanceof HTMLElement) held.focus();
    };
  }, []);

  useEffect(() => {
    const onDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && panel.current?.contains(event.target) !== true) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || panel.current === null) return;

    // Without this, Tab walks out of the overlay into the page behind it.
    const stops = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
    if (edge !== undefined && document.activeElement === edge) {
      event.preventDefault();
      (event.shiftKey ? stops[stops.length - 1] : stops[0])?.focus();
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm",
        size !== "full" && "pt-[10vh]",
      )}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full rounded-xl border border-line bg-surface-raised shadow-overlay",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-3xl",
          size === "full" &&
            "flex h-[min(54rem,calc(100dvh-2rem))] min-h-0 max-w-5xl flex-col overflow-hidden",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line-subtle px-4 py-3">
          <h2 id={labelId} className="text-sm font-semibold text-text">
            {title}
          </h2>
          <Button tone="ghost" size="sm" icon="close" label="Close" onClick={onClose} />
        </header>
        {children}
      </div>
    </div>
  );
}
