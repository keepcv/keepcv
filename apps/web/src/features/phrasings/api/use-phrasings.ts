import { deriveRevision, newUuid } from "@keepcv/core";
import type {
  Phrasing,
  PhrasingInput,
  PhrasingPatch,
  PhrasingSet,
  RichText,
  Store,
  Uuid,
} from "@keepcv/schema";
import { draftSchema, phrasingSchema, phrasingSetSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, useStoreMutation } from "../../../lib/store-cache.js";
import { bodyOf, draftTarget } from "../model/editor.js";

function replace<T extends { id: Uuid }>(rows: readonly T[], row: T): T[] {
  return rows.map((existing) => (existing.id === row.id ? row : existing));
}

function withoutDraft(store: Store, phrasingId: Uuid): Store {
  return {
    ...store,
    drafts: store.drafts.filter(
      (row) => !(row.targetKind === "phrasing" && row.targetId === phrasingId),
    ),
  };
}

// The boot payload narrows revisions to what each phrasing currently says, so
// the cached row is that projection and an edit rewrites it in place. The store
// still appends; the re-read brings back the new revision's own id.
function withText(store: Store, phrasing: Phrasing, body: RichText): Store {
  const derived = deriveRevision(body);
  return {
    ...store,
    phrasingRevisions: store.phrasingRevisions.map((row) =>
      row.id === phrasing.currentRevisionId ? { ...row, ...derived } : row,
    ),
  };
}

export interface DraftText {
  phrasingId: Uuid;
  text: string;
}

export function useSaveDraft(client: ApiClient) {
  return useStoreMutation<DraftText, void>({
    send: async ({ phrasingId, text }) => {
      await unwrap(
        await client.v1.drafts[":targetKind"][":targetId"][":field"].$put({
          param: draftTarget(phrasingId),
          json: { body: { body: bodyOf(text) } },
        }),
      );
    },
    optimistic: (store, { phrasingId, text }) => {
      const at = now();
      const draft = draftSchema.parse({
        ...draftTarget(phrasingId),
        createdAt: at,
        updatedAt: at,
        body: { body: bodyOf(text) },
      });
      const kept = withoutDraft(store, phrasingId);
      return { ...kept, drafts: [...kept.drafts, draft] };
    },
  });
}

export function useDiscardDraft(client: ApiClient) {
  return useStoreMutation<Uuid, void>({
    send: async (phrasingId) => {
      await unwrap(
        await client.v1.drafts[":targetKind"][":targetId"][":field"].$delete({
          param: draftTarget(phrasingId),
        }),
      );
    },
    optimistic: (store, phrasingId) => withoutDraft(store, phrasingId),
  });
}

export interface CommitText {
  phrasing: Phrasing;
  text: string;
  hasDraft: boolean;
}

// Appending and dropping the draft are one commit: a draft that outlived the
// revision it became would offer to restore text the phrasing already says.
export function useCommitPhrasing(client: ApiClient) {
  return useStoreMutation<CommitText, void>({
    send: async ({ phrasing, text, hasDraft }) => {
      await unwrap(
        await client.v1.phrasings[":id"].revisions.$post({
          param: { id: phrasing.id },
          json: { body: bodyOf(text) },
        }),
      );
      if (!hasDraft) return;
      await unwrap(
        await client.v1.drafts[":targetKind"][":targetId"][":field"].$delete({
          param: draftTarget(phrasing.id),
        }),
      );
    },
    optimistic: (store, { phrasing, text }) =>
      withText(withoutDraft(store, phrasing.id), phrasing, bodyOf(text)),
  });
}

export function useAddVariant(client: ApiClient) {
  return useStoreMutation<PhrasingInput, Phrasing>({
    send: async (input) =>
      phrasingSchema.parse(await unwrap(await client.v1.phrasings.$post({ json: input }))),
    optimistic: (store, input) => {
      const at = now();
      const { body, ...columns } = input;
      // The store mints the real revision id, since a content hash is what
      // makes an append idempotent. This one lives until the re-read.
      const revisionId = newUuid();

      return {
        ...store,
        phrasings: [
          ...store.phrasings,
          phrasingSchema.parse({
            ...columns,
            createdAt: at,
            updatedAt: at,
            archivedAt: null,
            currentRevisionId: revisionId,
          }),
        ],
        phrasingRevisions: [
          ...store.phrasingRevisions,
          { id: revisionId, createdAt: at, phrasingId: input.id, ...deriveRevision(body) },
        ],
      };
    },
  });
}

export interface UpdatePhrasing {
  phrasing: Phrasing;
  patch: PhrasingPatch;
}

export function useUpdatePhrasing(client: ApiClient) {
  return useStoreMutation<UpdatePhrasing, Phrasing>({
    send: async ({ phrasing, patch }) =>
      phrasingSchema.parse(
        await unwrap(
          await client.v1.phrasings[":id"].$patch({
            param: { id: phrasing.id },
            json: { expectedUpdatedAt: phrasing.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { phrasing, patch }) => ({
      ...store,
      phrasings: replace(
        store.phrasings,
        phrasingSchema.parse({ ...phrasing, ...patch, updatedAt: now() }),
      ),
    }),
  });
}

export interface SetCanonical {
  set: PhrasingSet;
  phrasingId: Uuid;
}

// The set points at the wording rather than the other way round, so switching
// which is canonical is one row and changes nothing a resume already pinned.
export function useSetCanonical(client: ApiClient) {
  return useStoreMutation<SetCanonical, PhrasingSet>({
    send: async ({ set, phrasingId }) =>
      phrasingSetSchema.parse(
        await unwrap(
          await client.v1["phrasing-sets"][":id"].$patch({
            param: { id: set.id },
            json: { expectedUpdatedAt: set.updatedAt, patch: { canonicalPhrasingId: phrasingId } },
          }),
        ),
      ),
    optimistic: (store, { set, phrasingId }) => ({
      ...store,
      phrasingSets: replace(store.phrasingSets, {
        ...set,
        canonicalPhrasingId: phrasingId,
        updatedAt: now(),
      }),
    }),
  });
}

export interface SetPhrasingArchived {
  phrasing: Phrasing;
  archived: boolean;
}

export function useSetPhrasingArchived(client: ApiClient) {
  return useStoreMutation<SetPhrasingArchived, Phrasing>({
    send: async ({ phrasing, archived }) => {
      const param = { id: phrasing.id };
      const json = { expectedUpdatedAt: phrasing.updatedAt };
      const response = archived
        ? await client.v1.phrasings[":id"].$delete({ param, json })
        : await client.v1.phrasings[":id"].restore.$post({ param, json });
      return phrasingSchema.parse(await unwrap(response));
    },
    optimistic: (store, { phrasing, archived }) => ({
      ...store,
      phrasings: replace(store.phrasings, {
        ...phrasing,
        archivedAt: archived ? now() : null,
        updatedAt: now(),
      }),
    }),
  });
}
