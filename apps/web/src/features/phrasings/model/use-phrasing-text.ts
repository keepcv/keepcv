import { draftFor, textOfPhrasing } from "@keepcv/core";
import type { Phrasing, Store } from "@keepcv/schema";
import { useEffect, useRef, useState } from "react";
import type { ApiClient } from "../../../lib/api.js";
import { useCommitPhrasing, useDiscardDraft, useSaveDraft } from "../api/use-phrasings.js";
import { actionFor, COMMIT_AFTER_MS, DRAFT_AFTER_MS, draftTarget, draftText } from "./editor.js";

export type EditorStatus = "clean" | "typing" | "draft-kept" | "committing" | "committed";

export interface PhrasingText {
  typed: string;
  committed: string;
  // Text from a previous session, offered rather than restored: the editor never
  // resurrects words the user believed they had abandoned.
  waiting: string | undefined;
  status: EditorStatus;
  error: unknown;
  onChange: (text: string) => void;
  onBlur: () => void;
  restore: () => void;
  discard: () => void;
}

export function usePhrasingText(client: ApiClient, store: Store, phrasing: Phrasing): PhrasingText {
  const committed = textOfPhrasing(store, phrasing);
  const draft = draftFor(store, draftTarget(phrasing.id));
  const saveDraft = useSaveDraft(client);
  const discardDraft = useDiscardDraft(client);
  const commit = useCommitPhrasing(client);

  const [typed, setTyped] = useState(committed);
  const [touched, setTouched] = useState(false);

  // The text comes from the timer that carries it; only what the store says is
  // read through the ref, which a pending timer would otherwise hold stale.
  function act(trigger: "debounce" | "settle", text: string): void {
    const action = actionFor({ typed: text, committed, hasDraft: draft !== undefined }, trigger);
    if (action === "save-draft") saveDraft.mutate({ phrasingId: phrasing.id, text });
    if (action === "discard-draft") discardDraft.mutate(phrasing.id);
    if (action === "commit") commit.mutate({ phrasing, text, hasDraft: draft !== undefined });
  }

  const latest = useRef(act);
  useEffect(() => {
    latest.current = act;
  });

  // Nothing runs until the user has typed: opening a point with a draft waiting
  // would otherwise discard it before the offer to restore it was answered.
  useEffect(() => {
    if (!touched) return undefined;
    const debounce = setTimeout(() => {
      latest.current("debounce", typed);
    }, DRAFT_AFTER_MS);
    const idle = setTimeout(() => {
      latest.current("settle", typed);
    }, COMMIT_AFTER_MS);

    return () => {
      clearTimeout(debounce);
      clearTimeout(idle);
    };
  }, [typed, touched]);

  const changed = typed.trim() !== committed;
  const status: EditorStatus = commit.isPending
    ? "committing"
    : changed
      ? draft === undefined
        ? "typing"
        : "draft-kept"
      : touched
        ? "committed"
        : "clean";

  return {
    typed,
    committed,
    // Only ever what was found on open: once the user types, the draft in the
    // store is the one this editor is writing, and offering it back would be the
    // editor interrupting itself mid-sentence.
    waiting: touched ? undefined : draftText(draft),
    status,
    error: saveDraft.error ?? discardDraft.error ?? commit.error,
    onChange: (text) => {
      setTouched(true);
      setTyped(text);
    },
    onBlur: () => {
      if (touched) act("settle", typed);
    },
    restore: () => {
      setTouched(true);
      setTyped(draftText(draft) ?? committed);
    },
    discard: () => {
      discardDraft.mutate(phrasing.id);
    },
  };
}
