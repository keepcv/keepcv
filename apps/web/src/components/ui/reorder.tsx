import type { Ordered, Reorder } from "../../lib/order.js";
import { Icon } from "../icon/icon.js";
import { Button } from "./button.js";

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
      <Button
        tone="ghost"
        size="sm"
        icon="moveUp"
        label={`Move ${subject} up`}
        disabled={order.isFirst(row)}
        onClick={() => {
          order.moveBy(row, -1);
        }}
      />
      <Button
        tone="ghost"
        size="sm"
        icon="moveDown"
        label={`Move ${subject} down`}
        disabled={order.isLast(row)}
        onClick={() => {
          order.moveBy(row, 1);
        }}
      />
    </>
  );
}

// Marks the row as something to pick up. `aria-hidden` because the buttons
// beside it already say what it does, and a grip a screen reader announces is
// an affordance it cannot then use.
export function DragGrip() {
  return (
    <span className="cursor-grab text-text-subtle/60 transition-colors group-hover:text-text-subtle active:cursor-grabbing">
      <Icon name="drag" size="sm" />
    </span>
  );
}
