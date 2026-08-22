import type { ReactNode } from "react";
import type { Ordered, Reorder } from "../../lib/order.js";

export function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// Both, always. Dragging is a pointer gesture and nothing else, so a list that
// only drags is a list a keyboard cannot order; the buttons are also the only
// half a screen reader can announce.
export function ReorderControls<T extends Ordered>({
  order,
  row,
  subject,
}: {
  order: Reorder<T>;
  row: T;
  subject: string;
}) {
  return (
    <>
      <RowButton
        label={`Move ${subject} up`}
        disabled={order.isFirst(row)}
        onClick={() => {
          order.moveBy(row, -1);
        }}
      >
        Up
      </RowButton>
      <RowButton
        label={`Move ${subject} down`}
        disabled={order.isLast(row)}
        onClick={() => {
          order.moveBy(row, 1);
        }}
      >
        Down
      </RowButton>
    </>
  );
}

// Marks the row as something to pick up. `aria-hidden` because the buttons
// beside it already say what it does, and a grip a screen reader announces is
// an affordance it cannot then use.
export function DragGrip() {
  return (
    <span
      aria-hidden
      className="cursor-grab select-none px-1 text-xs leading-none text-slate-300 active:cursor-grabbing"
    >
      ::
    </span>
  );
}
