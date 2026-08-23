import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "./button.js";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Hand-rolled rather than the `dialog` element: the palette wants the same
// overlay with its own sizing and no backdrop of the browser's choosing, and
// mixing `showModal` with React's ownership of the tree needs an effect either
// way (application-structure.md #2).
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
    // Only when nothing inside has claimed focus already. The close button is
    // the first focusable in the panel, so focusing it unconditionally stole
    // focus back from the palette's own field and swallowed what was typed.
    if (panel.current?.contains(held) !== true) {
      panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
    return () => {
      if (held instanceof HTMLElement) held.focus();
    };
  }, []);

  // On the document, like the menu's: a handler on the scrim makes it an
  // interactive static element, and closing has to work from inside the panel.
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 pt-[10vh] backdrop-blur-sm">
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
          size === "full" && "max-w-5xl",
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line-subtle px-4 py-3">
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
