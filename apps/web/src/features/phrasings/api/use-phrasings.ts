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
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";
import { draftTarget } from "../model/editor.js";

function withoutDraft(store: Store, phrasingId: Uuid): Store {
  return {
    ...store,
    drafts: store.drafts.filter(
      (row) => !(row.targetKind === "phrasing" && row.targetId === phrasingId),
    ),
  };
}

// Only the cache changes in place; persisted revisions stay append-only.
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
  body: RichText;
}

export function useSaveDraft(client: ApiClient) {
  return useStoreMutation<DraftText, void>({
    send: async ({ phrasingId, body }) => {
      await unwrap(
        await client.v1.drafts[":targetKind"][":targetId"][":field"].$put({
          param: draftTarget(phrasingId),
          json: { body: { body } },
        }),
      );
    },
    optimistic: (store, { phrasingId, body }) => {
      const at = now();
      const draft = draftSchema.parse({
        ...draftTarget(phrasingId),
        createdAt: at,
        updatedAt: at,
        body: { body },
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
  body: RichText;
  hasDraft: boolean;
}

// Remove the draft only after the revision append succeeds.
export function useCommitPhrasing(client: ApiClient) {
  return useStoreMutation<CommitText, void>({
    send: async ({ phrasing, body, hasDraft }) => {
      await unwrap(
        await client.v1.phrasings[":id"].revisions.$post({
          param: { id: phrasing.id },
          json: { body },
        }),
      );
      if (!hasDraft) return;
      await unwrap(
        await client.v1.drafts[":targetKind"][":targetId"][":field"].$delete({
          param: draftTarget(phrasing.id),
        }),
      );
    },
    optimistic: (store, { phrasing, body }) =>
      withText(withoutDraft(store, phrasing.id), phrasing, body),
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
      phrasings: replaceRow(
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
      phrasingSets: replaceRow(store.phrasingSets, {
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
      phrasings: replaceRow(store.phrasings, {
        ...phrasing,
        archivedAt: archived ? now() : null,
        updatedAt: now(),
      }),
    }),
  });
}
