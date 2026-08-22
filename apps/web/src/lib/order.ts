import { bySortKey, keyForPosition } from "@keepcv/core";
import type { SortKey, Uuid } from "@keepcv/schema";
import { type DragEvent, useState } from "react";

export interface Ordered {
  id: Uuid;
  sortKey: SortKey;
  archivedAt: string | null;
}

export interface RowProps {
  draggable: true;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  "data-held": boolean;
}

export interface Reorder<T extends Ordered> {
  isFirst: (row: T) => boolean;
  isLast: (row: T) => boolean;
  moveBy: (row: T, delta: number) => void;
  rowProps: (row: T) => RowProps;
}

// `scope` is every row the sort-key index covers, archived included: a row taken
// off a list keeps its key, and one computed from the live neighbours alone can
// collide with it (data-model.md #3.5). A move writes one row, and a move that
// changes nothing writes none.
export function useReorder<T extends Ordered>(
  scope: readonly T[],
  onMove: (row: T, sortKey: SortKey) => void,
): Reorder<T> {
  const [held, setHeld] = useState<Uuid | null>(null);
  const rows = scope.filter((row) => row.archivedAt === null).sort(bySortKey);
  const at = (id: Uuid): number => rows.findIndex((row) => row.id === id);

  function moveTo(row: T, toIndex: number): void {
    const sortKey = keyForPosition(scope, row.id, toIndex);
    if (sortKey !== undefined) onMove(row, sortKey);
  }

  return {
    isFirst: (row) => at(row.id) === 0,
    isLast: (row) => at(row.id) === rows.length - 1,
    moveBy: (row, delta) => {
      moveTo(row, at(row.id) + delta);
    },
    // The row being dragged is in state rather than in `dataTransfer`, which
    // jsdom does not implement at all.
    rowProps: (row) => ({
      draggable: true,
      "data-held": held === row.id,
      onDragStart: () => {
        setHeld(row.id);
      },
      onDragEnd: () => {
        setHeld(null);
      },
      onDragOver: (event) => {
        if (held !== null && held !== row.id) event.preventDefault();
      },
      onDrop: (event) => {
        event.preventDefault();
        const source = rows.find((candidate) => candidate.id === held);
        setHeld(null);
        if (source !== undefined) moveTo(source, at(row.id));
      },
    }),
  };
}
