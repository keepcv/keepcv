import type { DraftRepository } from "@keepcv/core";
import { type Draft, type DraftTarget, draftSchema } from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { draft, phrasing, record } from "../schema/index.js";
import { type OwnedTable, requireOwned, toTimestamp } from "./owned-row.js";

type DraftRow = typeof draft.$inferSelect;

// An unknown kind falls through to draft_target_kind_check, so the vocabulary
// is declared once rather than twice.
const TARGETS: Record<string, OwnedTable | undefined> = { phrasing, record };

function toDraft(row: DraftRow): Draft {
  return draftSchema.parse({
    targetKind: row.targetKind,
    targetId: row.targetId,
    field: row.field,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    body: row.body,
  });
}

export function createDraftRepository(db: Database): DraftRepository {
  function keyed(target: DraftTarget) {
    return and(
      eq(draft.ownerId, currentOwnerId()),
      eq(draft.targetKind, target.targetKind),
      eq(draft.targetId, target.targetId),
      eq(draft.field, target.field),
    );
  }

  async function requireTarget(target: DraftTarget): Promise<void> {
    const table = TARGETS[target.targetKind];
    if (table !== undefined) {
      await requireOwned(db, table, target.targetKind, target.targetId);
    }
  }

  return {
    async list() {
      const rows = await db
        .select()
        .from(draft)
        .where(eq(draft.ownerId, currentOwnerId()))
        .orderBy(asc(draft.targetKind), asc(draft.targetId), asc(draft.field));
      return rows.map(toDraft);
    },

    // `created_at` stays put, so the editor can say how long the text has sat.
    async save(target, body) {
      await requireTarget(target);
      const [row] = await db
        .insert(draft)
        .values({ ...target, ownerId: currentOwnerId(), body })
        .onConflictDoUpdate({
          target: [draft.ownerId, draft.targetKind, draft.targetId, draft.field],
          set: { body, updatedAt: new Date() },
        })
        .returning();
      if (row === undefined) {
        throw new Error("insert into draft returned no row");
      }
      return toDraft(row);
    },

    // The one delete in the store, and deliberate.
    async discard(target) {
      await requireTarget(target);
      await db.delete(draft).where(keyed(target));
    },
  };
}
