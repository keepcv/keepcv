import { deriveRevision, draftFor } from "@keepcv/core";
import type { Phrasing, RichText, Store } from "@keepcv/schema";
import { richTextSchema } from "@keepcv/schema";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ApiClient } from "../../../lib/api.js";
import { keepEdit, readEdit } from "../../../lib/edit-recovery.js";
import { useCommitPhrasing, useDiscardDraft, useSaveDraft } from "../api/use-phrasings.js";
import { actionFor, COMMIT_AFTER_MS, DRAFT_AFTER_MS, draftBody, draftTarget } from "./editor.js";
import { trimBody } from "./markup.js";

export type EditorStatus = "clean" | "typing" | "draft-kept" | "committing" | "committed";

function statusOf(
  working: boolean,
  changed: boolean,
  hasDraft: boolean,
  touched: boolean,
): EditorStatus {
  if (working) return "committing";
  if (changed) return hasDraft ? "draft-kept" : "typing";
  return touched ? "committed" : "clean";
}

export function usePhrasingText(client: ApiClient, store: Store, phrasing: Phrasing) {
  const committed =
    store.phrasingRevisions.find((row) => row.id === phrasing.currentRevisionId)?.body ?? [];
  const draft = draftFor(store, draftTarget(phrasing.id));
  const saveDraft = useSaveDraft(client);
  const discardDraft = useDiscardDraft(client);
  const commit = useCommitPhrasing(client);
  const [typed, setTyped] = useState<RichText>(committed);
  const recoveryKey = `keepcv.phrasing-edit:${phrasing.id}`;
  const [recovered] = useState(() => richTextSchema.safeParse(readEdit(recoveryKey)).data);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState(false);
  const flight = useRef(Promise.resolve());
  const latest = useRef({
    committed,
    draft,
    phrasing,
    typed,
    touched,
    saveDraft,
    discardDraft,
    commit,
  });
  latest.current = { committed, draft, phrasing, typed, touched, saveDraft, discardDraft, commit };

  const act = useRef((trigger: "debounce" | "settle", typedBody: RichText): Promise<boolean> => {
    const body = trimBody(typedBody);
    const work = async () => {
      const current = latest.current;
      const action = actionFor(
        { typed: body, committed: current.committed, hasDraft: current.draft !== undefined },
        trigger,
      );
      setWorking(true);
      if (action === "save-draft")
        await current.saveDraft.mutateAsync({ phrasingId: current.phrasing.id, body });
      if (action === "discard-draft") await current.discardDraft.mutateAsync(current.phrasing.id);
      if (action === "commit") {
        await current.saveDraft.mutateAsync({ phrasingId: current.phrasing.id, body });
        await current.commit.mutateAsync({ phrasing: current.phrasing, body, hasDraft: true });
      }
      const local = richTextSchema.safeParse(readEdit(recoveryKey)).data;
      if (
        local !== undefined &&
        deriveRevision(trimBody(local)).contentHash === deriveRevision(body).contentHash
      )
        keepEdit(recoveryKey, undefined);
    };
    const result = flight.current
      .then(work)
      .then(
        () => {
          setError(null);
          return true;
        },
        (reason: unknown) => {
          setError(reason);
          return false;
        },
      )
      .finally(() => {
        setWorking(false);
      });
    flight.current = result.then(() => undefined);
    return result;
  });

  useEffect(() => {
    if (!touched) return;
    const debounce = setTimeout(() => {
      void act.current("debounce", typed);
    }, DRAFT_AFTER_MS);
    const idle = setTimeout(() => {
      void act.current("settle", typed);
    }, COMMIT_AFTER_MS);
    return () => {
      clearTimeout(debounce);
      clearTimeout(idle);
    };
  }, [typed, touched]);

  useEffect(
    () => () => {
      const current = latest.current;
      if (
        current.touched &&
        actionFor(
          { typed: current.typed, committed: current.committed, hasDraft: false },
          "settle",
        ) !== "none"
      ) {
        void act.current("debounce", current.typed);
      }
    },
    [],
  );

  const changed = actionFor({ typed, committed, hasDraft: false }, "settle") !== "none";
  useBlocker({
    shouldBlockFn: async () => !(await act.current("settle", latest.current.typed)),
    enableBeforeUnload: touched && (changed || working),
    disabled: !touched || (!changed && !working),
  });
  const status = statusOf(working, changed, draft !== undefined, touched);
  return {
    typed,
    committed,
    waiting: touched ? undefined : (recovered ?? draftBody(draft)),
    status,
    error,
    onChange: (body: RichText) => {
      keepEdit(recoveryKey, body);
      setTouched(true);
      setTyped(body);
    },
    onBlur: () => {
      if (touched) void act.current("settle", typed);
    },
    retry: () => {
      void act.current("settle", typed);
    },
    restore: () => {
      const body = recovered ?? draftBody(draft) ?? committed;
      keepEdit(recoveryKey, body);
      setTouched(true);
      setTyped(body);
    },
    discard: () => {
      keepEdit(recoveryKey, undefined);
      void discardDraft.mutateAsync(phrasing.id).then(() => {
        setTouched(true);
      }, setError);
    },
  };
}
