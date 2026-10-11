import { deriveRevision, keyForPosition, newUuid, phrasingsOfSet } from "@keepcv/core";
import type {
  Draft,
  DraftTarget,
  Phrasing,
  PhrasingInput,
  PhrasingVariant,
  RichText,
  Store,
  Uuid,
} from "@keepcv/schema";
import { phrasingInputSchema, richTextSchema } from "@keepcv/schema";
import { trimBody } from "./markup.js";

export const DRAFT_AFTER_MS = 800;
export const COMMIT_AFTER_MS = 30_000;

export function draftTarget(phrasingId: Uuid): DraftTarget {
  return { targetKind: "phrasing", targetId: phrasingId, field: "body" };
}

export function bodyOf(text: string): RichText {
  const trimmed = text.trim();
  return trimmed === "" ? [] : [{ t: "text", v: trimmed }];
}

// A draft is deliberately unvalidated, so a body written by an older shape
// reads as no draft rather than as a crash on open.
export function draftBody(draft: Draft | undefined): RichText | undefined {
  if (draft === undefined) return undefined;
  const parsed = richTextSchema.safeParse(draft.body["body"]);
  return parsed.success ? parsed.data : undefined;
}

export type EditorAction = "none" | "save-draft" | "discard-draft" | "commit";

export interface EditorState {
  typed: RichText;
  committed: RichText;
  hasDraft: boolean;
}

export function actionFor(state: EditorState, trigger: "debounce" | "settle"): EditorAction {
  if (
    deriveRevision(trimBody(state.typed)).contentHash ===
    deriveRevision(trimBody(state.committed)).contentHash
  )
    return state.hasDraft ? "discard-draft" : "none";
  return trigger === "debounce" ? "save-draft" : "commit";
}

export function canonicalPhrasing(store: Store, phrasingSetId: Uuid): Phrasing | undefined {
  const set = store.phrasingSets.find((row) => row.id === phrasingSetId);
  return store.phrasings.find((row) => row.id === set?.canonicalPhrasingId);
}

export const VARIANT_HINTS: Record<PhrasingVariant, string> = {
  standard: "The wording you reach for first.",
  short: "For a resume that has run out of room.",
  long: "The full version, for when there is space.",
  angled: "Aimed at one kind of role.",
};

export interface NewVariant {
  phrasingSetId: Uuid;
  variant: PhrasingVariant;
  label: string;
  body: RichText;
}

// Started from the wording it is a variant of: a blank box is a phrasing that
// says nothing, which is not a state worth being able to reach.
export function buildVariant(store: Store, variant: NewVariant): PhrasingInput {
  const siblings = phrasingsOfSet(store, variant.phrasingSetId);
  return phrasingInputSchema.parse({
    id: newUuid(),
    phrasingSetId: variant.phrasingSetId,
    variant: variant.variant,
    label: variant.label.trim() === "" ? null : variant.label.trim(),
    sortKey: keyForPosition(siblings, null, siblings.length),
    body: variant.body,
  });
}
