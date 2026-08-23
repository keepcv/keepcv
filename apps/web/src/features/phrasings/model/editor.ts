import { keyForPosition, newUuid, phrasingsOfSet, projectPlainText } from "@keepcv/core";
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

export const DRAFT_AFTER_MS = 800;
export const COMMIT_AFTER_MS = 30_000;

export function draftTarget(phrasingId: Uuid): DraftTarget {
  return { targetKind: "phrasing", targetId: phrasingId, field: "body" };
}

// One paragraph and no marks yet: the schema allows bold, italic and links, and
// the input that produces them is its own piece of work.
export function bodyOf(text: string): RichText {
  const trimmed = text.trim();
  return trimmed === "" ? [] : [{ t: "text", v: trimmed }];
}

// A draft is deliberately unvalidated, so a body written by an older shape
// reads as no draft rather than as a crash on open.
export function draftText(draft: Draft | undefined): string | undefined {
  if (draft === undefined) return undefined;
  const parsed = richTextSchema.safeParse(draft.body["body"]);
  return parsed.success ? projectPlainText(parsed.data) : undefined;
}

export type EditorAction = "none" | "save-draft" | "discard-draft" | "commit";

export interface EditorState {
  typed: string;
  committed: string;
  hasDraft: boolean;
}

export function actionFor(state: EditorState, trigger: "debounce" | "settle"): EditorAction {
  if (state.typed.trim() === state.committed) return state.hasDraft ? "discard-draft" : "none";
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
  text: string;
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
    body: bodyOf(variant.text),
  });
}
